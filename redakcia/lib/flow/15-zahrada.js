// ============================================================
// 15. Záhrada — sezónny generátor (NIE facts-driven pipeline)
// ------------------------------------------------------------
// ROLA:          Raz denne napíše JEDEN článok z ROČNÉHO PLÁNU tém, nie
//                z udalosti. Vstupom nie je RSS ani facts JSON, ale osnova
//                v content/zahrada/plan.md.
// VSTUP:         content/zahrada/plan.md (nie queue status)
// VÝSTUP status: rovno 'proofed' — obchádza 01-07 AJ 08 zámerne, viď nižšie.
// STAV:          🟢 MVP
// AI vrstva:     1 Sonnet (napíše článok z osnovy)
// ------------------------------------------------------------
// PREČO VLASTNÝ SPÚŠŤAČ (BIBLIA-ZAHRADA.md kapitola 3): záhradkárstvo nemá
// udalosti. Nikto nevydá tlačovú správu „práve nastal čas na rez ríbezlí".
// 01-scout by čerpal cudzie záhradkárske RSS (presne to, čo tomuto webu
// neprospieva), 02-gateway by evergreen osnovu zahodil ako starú
// (FEED_MAX_AGE_DAYS) a 05-verification nemá z čoho extrahovať fakty —
// osnova nie je udalosť. Celá reťaz 01-06 sa preto obchádza úplne.
//
// PREČO SA OBCHÁDZA AJ 08-proofreader (VSTUP ROVNO 'proofed', nie 'written'):
// 08 kontroluje článok PROTI FACTS — či tvrdenie sedí so zdrojom. Záhrada
// facts v tomto zmysle nemá; osnova je zadanie, nie extrahovaný fakt, takže
// kontrola „je to podložené faktami" by buď zbytočne strhala article na kosti
// (facts=[] → skoro všetko „nepodložené"), alebo by bežala naprázdno. Kvalitu
// tu drží namiesto toho: (a) tento prompt, (b) 09-legal nižšie s vlastnými
// kontrolami pre sekciu (viď 09-legal.js), (c) človek v Telegrame. Overené
// grepom: nič v repozitári nečíta article.proofread, takže vynechanie tohto
// poľa nič nerozbije.
//
// 09-legal (atribúcia/zdroje/investičné rady) AJ 11-image AJ 12-publisher
// BEŽIA ĎALEJ NEZMENENÉ — len 09 a 11 majú pre sekciu 'zahrada' vlastnú
// vetvu (viď komentáre v tých súboroch). Telegram schvaľovanie platí rovnako
// ako pre každý iný článok — MANUAL_APPROVAL to rieši v 12-publisher, tu sa
// netreba pýtať znova.
// ============================================================

import { db } from '../_shared/queue.js';
import { askFull } from '../_shared/ai-gateway.js';
import { parseModelJson } from '../_shared/json.js';
import { loadPlan, ZDROJE } from '../_shared/zahrada-plan.js';
import { jeVOkne, dniDoKoncaOkna } from '../_shared/zahrada-plan.js';

const AGENT = '15-zahrada';
const SRC = 'zahrada';

// Od ktorej hodiny smie generátor bežať — AŽ PO rannom recape (13-market-recap
// beží od 7:00), nech má používateľ v Telegrame veci v rozumnom poradí.
// Nočnú pauzu (22:00-5:00) rieši už run-pipeline.mjs zastavením celého behu,
// toto je DRUHÁ, jemnejšia brána vnútri aktívneho okna.
const GENERATOR_HOUR = Number(process.env.ZAHRADA_GENERATOR_HOUR ?? 9);

// Slug obsahuje "škodc"/"chorob"... → článok bez AI obrázka. Dôvod je
// v BIBLIA-ZAHRADA.md kapitola 8: vygenerovaná voška vyzerá presvedčivo a je
// vymyslená, čitateľ podľa nej koná. Heuristika beží nad slugom AJ osnovou —
// nie je to pole v pláne (netreba prepisovať 84 tém kvôli trom výnimkám),
// ale KAŽDÝ nový slug s týmito slovami cez ňu prejde automaticky, aj bez
// toho, aby si na to niekto musel pri písaní osnovy spomenúť.
//
// POZOR na \b s diakritikou: JS \b je definované cez ASCII \w, takže pred
// „š" (nie je v \w) NIKDY nenastane hranica slova — presne tá istá tichá
// chyba, akú má KRYPTO_RE (zdokumentované v koreňovom CLAUDE.md, tam
// zámerne neopravené). Tu sa jej treba vyhnúť: (?<![\p{L}]) s `u` flagom
// funguje na ľubovoľnom písmene Unicode, nielen ASCII.
//
// REGEX SÁM O SEBE NESTAČÍ — overené na reálnom pláne. Chytí falošné
// NEGATÍVA (skodcovia-na-okrasnych-rastlinach píše o „mšiciach, moliciach,
// pavúčikoch", nikde slovo „škodca") aj falošné POZITÍVA (izbovky-presun-dnu
// len mimochodom spomína „kontrolu škodcov pred presunom", nejde o
// identifikačný článok). Preto je tu EXPLICITNÝ zoznam ako hlavný mechanizmus
// — over ONE reálnych 3 tém, presný — a regex len PRIDÁVA ďalšie prípady,
// nikdy needuberá. Falošný pozitív (article príde o atmosférickú fotku
// navyše) je bezpečná chyba; falošný negatív (vymyslená choroba vyzerá
// presvedčivo) nie je. Pri novom pestovom/chorobovom slugu v pláne over
// ručne, či sem patrí — regex je poistka, nie záruka.
const NO_IMAGE_SLUGS = new Set([
  'skodcovia-v-zahrade-ako-postupovat',
  'choroby-rastlin-prevencia',
  'skodcovia-na-okrasnych-rastlinach',
]);
const NO_IMAGE_RE = /(?<![\p{L}])(škodc|škodl|chorob|pliesň|pliesne|hniloba|háďat|voš|roztoč)/iu;
const jeIdentifikacneRiziko = (topic) =>
  NO_IMAGE_SLUGS.has(topic.slug) || NO_IMAGE_RE.test(`${topic.slug} ${topic.osnova}`);

function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

// ---------- Ktoré slugy už NIEKEDY vznikli (nie len tento rok) ----------
//
// ZÁMERNE bez ohraničenia na rok. Plán počíta s tým, že v 2. roku sa téma
// AKTUALIZUJE, nie píše znova (viď hlavička plan.md) — tú funkciu ale tento
// súbor ešte NEROBÍ. Bez ročného orezania teda každý slug môže vzniknúť
// NAJVIAC RAZ NAVŽDY, kým aktualizačný režim nepribudne. Bezpečnejšia chyba
// je „téma tento rok chýba", nie „na webe sú dve URL na tú istú otázku" —
// presne to duplicitné URL by inak od druhého roku kanibalizovalo vlastné
// vyhľadávanie.
// TODO pred 2027-01: buď dorobiť aktualizačný režim, alebo toto vedomé
// obmedzenie zdokumentovať používateľovi znova, nech sa nestratí v čase.
async function pouziteSlugy() {
  const { data, error } = await db.from('queue')
    .select('raw_data')
    .eq('raw_data->>_src', SRC);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.raw_data?.slug).filter(Boolean));
}

async function generovaneDnes() {
  const { data, error } = await db.from('queue')
    .select('id').eq('raw_data->>_src', SRC).eq('raw_data->>day', dayKey()).limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

// ---------- Výber dnešnej témy ----------
// priorita 1 pred 2 pred 3; pri zhode vyhráva téma, ktorej okno sa zatvára
// skôr — nech sa nepremešká úzke okno kvôli téme, ktorá má na seba ešte
// mesiace času.
export function vyberTemu(temy, usedSlugy, now = new Date()) {
  const kandidati = temy.filter((t) => jeVOkne(t.obdobie, now) && !usedSlugy.has(t.slug));
  if (!kandidati.length) return null;
  kandidati.sort((a, b) => {
    if (a.priorita !== b.priorita) return a.priorita - b.priorita;
    return dniDoKoncaOkna(a.obdobie, now) - dniDoKoncaOkna(b.obdobie, now);
  });
  return kandidati[0];
}

// ---------- Zdroje pre article.sources ----------
// Inštitúcia (keď ju téma má) ide PRVÁ — do stĺpca E v hárku ide len prvý
// zdroj, a keď existuje skutočná autorita, patrí tam ona, nie samoodkaz.
// Nikdy sa nevymýšľa URL — len KĽÚČ do ZDROJE, register je jediné miesto,
// kde reálna adresa žije (rovnaký princíp ako v plan-check.mjs).
function buildSources(topic) {
  const sources = [];
  for (const key of topic.zdroje) {
    const inst = ZDROJE[key];
    if (inst) sources.push({ name: inst.nazov, url: inst.url, type: 'primary' });
  }
  sources.push({ name: 'Novinko — Záhrada', url: '', type: 'primary' });
  return sources;
}

// ---------- Writer prompt ----------
// Tvrdé zákazy nižšie sú PRVÁ vrstva (BIBLIA-ZAHRADA.md kapitola 5: „idú do
// promptu AJ do kontrolného kroku — jedna vrstva nestačí, model inštrukciu
// občas obíde"). Druhá vrstva sú strojové kontroly v 09-legal.js.
const ZAHRADA_WRITER_SYSTEM = `Si slovenský redaktor rubriky Záhrada. Píšeš pre bežného čitateľa, ktorý nie je odborník — praktické rady o pestovaní, nie akademický text.

Dostaneš OSNOVU — heslovitý podklad, o čom má článok byť. NIE je to hotový text ani súbor faktov, je to zadanie na rozpísanie. Napíš z neho pôvodný, plynulý článok v slovenčine, vlastnými slovami — nekopíruj vety z osnovy doslovne.

Výstup je IBA validný JSON, bez code fences, bez prózy navyše.
Schéma výstupu: {"headline": string, "perex": string, "body": string}

ŠTÝL:
- Vykaj čitateľovi. Priateľský, ale vecný tón — nie hovorový, nie akademický.
- Dĺžka 350-600 slov podľa toho, koľko je v osnove skutočne látky. Nevypĺňaj vatou — keď osnova nestačí na dlhší text, kratší je správna odpoveď.
- "headline": max ~10 slov, vecný, nie senzačný.
- "perex": 1-2 vety, zhrnutie hlavnej myšlienky.
- "body": odseky oddelené prázdnym riadkom (blank line), žiadny markdown nadpis, žiadne odrážky.
- Vysvetli aj PREČO, nie len ČO — kontext robí radu zapamätateľnou.

TERMÍNY — najčastejšia chyba, ktorou sa amatér prezradí:
- NIKDY presný dátum ("15. marca"). Termín viaž na fázu rastliny, počasie alebo teplotu, presne tak, ako to robí osnova. Slovensko má viac klimatických oblastí naraz.
- Ak osnova rozlišuje regióny (nížiny/hory, sever/juh), zachovaj to rozlíšenie v texte.

TVRDÉ ZÁKAZY (kontrolujú sa aj strojovo pred zverejnením — obídenie sa neoplatí, článok len spadne):
- ŽIADNY konkrétny prípravok na ochranu rastlín, jeho značka, dávkovanie ani ochranná doba. Len všeobecne: "existujú registrované prípravky, riaď sa etiketou a registrom ÚKSÚP".
- ŽIADNE huby. Ak sa téma húb dotkne čo i len okrajovo, tú časť úplne vynechaj — zámena jedlej a jedovatej huby je smrteľná a text ju nedokáže vylúčiť.
- ŽIADNE zdravotné tvrdenia o bylinkách ("lieči", "pomáha na", "znižuje riziko"). Bylinka je rastlina, nie liek.
- ŽIADNA značka výrobku, náradia, hnojiva ani osiva — len druhová kategória ("dusíkaté hnojivo", nikdy názov konkrétneho balenia).
- ŽIADNE odporúčanie vysadiť inváznu rastlinu (napr. pajaseň, boľševník, krídlatka, zlatobyľ, netýkavka žliazkatá) — ich šírenie zakazuje zákon.
- ŽIADNE usmrcovanie stavovcov (krt, vtáky, kuny, hlodavce) — len odpudzovanie.
- ŽIADNY zber rastlín z prírody — byliny a plodiny sa PESTUJÚ, nezbierajú.
- ŽIADNA rada, čo si má čitateľ kúpiť, ani výzva na kúpu ("kúpte si", "oplatí sa investovať do").

Ak osnova niektorú z týchto tém spomína (napr. škodcov), spracuj ju LEN v medziach zákazov vyššie — čo urobiť VŠEOBECNE, nikdy konkrétne meno prípravku či dávku.`;

function buildPrompt(topic) {
  let p = `TÉMA (slug): ${topic.slug}\nOBLASŤ: ${topic.oblast}\nTYP ČLÁNKU: ${topic.typ}\n\nOSNOVA:\n${topic.osnova}`;
  if (topic.zdroje.length) {
    const nazvy = topic.zdroje.map((k) => ZDROJE[k]?.nazov).filter(Boolean).join(', ');
    if (nazvy) {
      p += `\n\nZDROJ NA CITOVANIE: ${nazvy}. Ak to znie prirodzene, odkáž naň v texte `
         + `(napr. "podľa registra ÚKSÚP"). Nevymýšľaj inú inštitúciu ani odkaz.`;
    }
  }
  if (topic.typ === 'prehlad') {
    p += `\n\nTOTO JE MESAČNÝ PREHĽAD: krátky súhrn cez viaceré oblasti záhrady naraz, `
       + `nie hĺbkový návod. Nerozvádzaj detaily nad rámec osnovy — tie patria do `
       + `samostatných článkov. Cieľ je orientácia, nie vyčerpávajúci postup.`;
  }
  return p;
}

// ---------- Napíš JEDEN článok ----------
export async function napisClanok(topic) {
  const raw = await askFull({
    tier: 'smart',
    agent: AGENT,
    section: 'zahrada',
    system: ZAHRADA_WRITER_SYSTEM,
    prompt: buildPrompt(topic),
    maxTokens: 1600,
    temperature: 0.5,
  });
  const pokus = parseModelJson(raw.text);
  if (!pokus.ok) {
    throw new Error(`Writer vrátil non-JSON: ${raw.text.slice(0, 200)}`);
  }
  const a = pokus.value;
  if (!a.headline || !a.body) throw new Error('Writer vynechal headline alebo body');

  return {
    headline: String(a.headline).trim(),
    perex: a.perex ? String(a.perex).trim() : null,
    body: String(a.body).trim(),
    section: 'zahrada',
    category: 'zahrada',
    sources: buildSources(topic),
    no_ai_image: jeIdentifikacneRiziko(topic),
    generated_by: 'zahrada',
    zahrada_typ: topic.typ,
  };
}

// ---------- Vstupný bod pre pipeline ----------
export async function run({ force = false, dryRun = false } = {}) {
  const now = new Date();
  const hour = now.getHours();
  if (!force && hour < GENERATOR_HOUR) return { skipped: `pred ${GENERATOR_HOUR}:00` };
  if (!force && await generovaneDnes()) return { skipped: 'dnešný článok už existuje' };

  const temy = loadPlan();
  const used = await pouziteSlugy();
  const topic = vyberTemu(temy, used, now);
  if (!topic) return { skipped: 'žiadna téma v okne (alebo všetky použité)' };

  if (dryRun) return { dryRun: true, slug: topic.slug, oblast: topic.oblast, typ: topic.typ };

  const article = await napisClanok(topic);

  const { error } = await db.from('queue').insert({
    source_id: null,
    status: 'proofed',
    raw_data: { _src: SRC, slug: topic.slug, day: dayKey(now) },
    facts: { attribution_required: false, section: 'zahrada' },
    article,
  });
  if (error) throw error;

  return { written: topic.slug, headline: article.headline, no_ai_image: article.no_ai_image };
}
