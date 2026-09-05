// ============================================================
// 09. Legal
// ------------------------------------------------------------
// ROLA:          Posledná brána pred publikovaním. Checklist bez AI:
//                je atribúcia tam, kde ju vyžadujú fakty? nie sú v texte
//                investičné odporúčania? nie je prevzatá citácia pridlhá?
//                má článok zdroje?
// VSTUP status:  proofed
// VÝSTUP status: legal_ok
// STAV:          🟢 MVP (rule-based)
// AI vrstva:     0 žiadna — celá kontrola je zadarmo
// ------------------------------------------------------------
// PREČO JE TVRDÁ: porušenie atribúcie alebo investičné poradenstvo nie je
// štylistická chyba, ktorú by sa oplatilo prepisovať. Článok, ktorý neprejde,
// ide do 'rejected' s presným dôvodom — nepokračuje na obrázok ani publish.
//
// Zdroj pravidiel: novinko pravidla/07_Autorske_prava_a_politika_citacii,
// 04_AI_Editorial_Constitution, 02_Eticky_kodex + Sourcing model v CLAUDE.md.
//
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

import { claim, advance } from '../_shared/queue.js';

export const STAGE = {
  index: 9,
  name: "Legal",
  input: "proofed",
  output: "legal_ok",
};

const AGENT = '09-legal';

// Maximálna dĺžka doslovnej citácie zo sekundárneho zdroja (fair use).
const MAX_QUOTE_CHARS = Number(process.env.LEGAL_MAX_QUOTE_CHARS ?? 300);

// Investičné odporúčania — nesmieme ich vydávať (nie sme licencovaní).
// Cieľ je VÝZVA čitateľovi ku konaniu, nie opis diania na trhu.
const ADVICE_RE = /\b(odpor[uú]čame|radíme vám|mali by ste (kúpiť|predať|investovať)|(kúpte|predajte|investujte|nakúpte)\s|(určite|rozhodne)\s+(kúpte|investujte)|garantovan[ýé]\s+(zisk|výnos)|istý\s+zisk|nenechajte si ujsť príležitosť|teraz je čas (kúpiť|nakúpiť))/i;

// SPOTREBITEĽSKÁ RADA — hospodárska obdoba investičného poradenstva.
//
// PREČO ZVLÁŠŤ: pri krypte je prirodzené zlyhanie „kúpte tento token". Pri
// hospodárskej rubrike vyzerá inak a nevinnejšie: „oplatí sa fixovať sadzbu",
// „je čas refinancovať hypotéku". Vzniká priamo z kontextového bloku, ktorý má
// Writer pre ekonomiku povolený (vyššie sadzby → drahšie hypotéky) — odtiaľ je
// ku rade čitateľovi jeden krok. ADVICE_RE vyššie to nechytí, lebo tam nie je
// ani jedno z tých slovies.
//
// CIELENÉ NA IMPERATÍV A DRUHÚ OSOBU, nie na atribuovaný výrok. „Podľa {banka}
// ľudia zvažujú refinancovanie" je legitímne spravodajstvo a článok sa preň
// zamietať nesmie — kontrola nižšie by inak strieľala do vlastných radov.
const CONSUMER_ADVICE_RE = /\b((oplatí sa|je (teraz )?čas|je vhodné)\s+(si\s+)?(fixova|refinancova|sporiť|investova|nakúpi|presunú)|mali by ste\s+(si\s+)?(fixova|refinancova|sporiť|presunú|zvážiť)|zvážte\s+(si\s+)?(fixáciu|refinancovanie|presun|nákup|predaj|investíc)|(fixujte|refinancujte|sporte|presuňte)\b)/i;

// ============================================================
// ZÁHRADA — vlastný profil kontrol (od 2026-09-07)
// ------------------------------------------------------------
// PREČO VLASTNÝ PROFIL: CHECKS nižšie sú postavené pre AGREGOVANÉ
// spravodajstvo — priznaj, čo si prevzal (atribúcia), nedávaj investičné rady
// (ADVICE_RE/CONSUMER_ADVICE_RE). Záhrada je presný opak: pôvodné know-how,
// ktoré JE rada od začiatku do konca. Overené naživo pred zavedením profilu:
// bežná záhradná veta „Odporúčame rez naplánovať pred pučaním" padala na
// investičné-poradenstvo, hoci „odporúčame" tam znamená len „navrhujeme",
// nie kúpne odporúčanie — generický regex je pre túto rubriku nesprávna
// doména, nie chyba v regexe.
//
// Riziko Záhrady nie je zlá atribúcia, je ŠKODLIVÁ RADA (BIBLIA-ZAHRADA.md
// kapitola 5). Preto úplne iná sada kontrol nižšie.
//
// SPOLOČNÝ PRINCÍP VŠETKÝCH: falošný pozitív (článok ide na 'rejected', hoci
// bol v poriadku) je zotaviteľná chyba — MANUAL_APPROVAL aj tak stojí medzi
// každým článkom a webom, človek si to prečíta v Telegrame. Falošný negatív
// (škodlivá rada prejde) nie je. Kontroly preto zámerne CHYTAJÚ ŠIRŠIE, než
// je nutné — presný opak filozofie ADVICE_RE vyššie, kde falošný pozitív
// stojí čitateľnosť článku o niečo viac.
//
// (?<![\p{L}]) s `u` flagom namiesto \b VŠADE, aj tam, kde by \b dnes
// fungoval (stem začína ASCII písmenom) — jednotný štýl, nech sa nabudúce
// nezopakuje chyba z 15-zahrada.js (a KRYPTO_RE pred ňou): \b je v JS
// definované cez ASCII \w, takže pred diakritickým písmenom hranica slova
// nikdy nenastane.
const ZAHRADA_PRIPRAVOK_RE = /(?<![\p{L}])(\d+([.,]\d+)?\s?(ml|g)\s*(na|\/)\s*(1\s?)?(liter|l)(?![\p{L}])|\d+([.,]\d+)?\s?%\s*roztok\w*|postrekov\w*|aplikuj\w*|dávkovan\w*|ochrann[áa]\s+dob\w*)/iu;
const ZAHRADA_HUBY_RE = /(?<![\p{L}])(huba|huby|húb\w*|hríb\w*|muchotrávk\w*|bedľ\w*|pečiark\w*)/iu;
const ZAHRADA_ZDRAVIE_RE = /(?<![\p{L}])(lieči\w*|pomáha(jú)?\s+na|znižuje\s+riziko|zníži\s+riziko|hojí\w*|zmierňuje\s+príznaky|posilňuje\s+imunitu)/iu;
const ZAHRADA_DATUM_RE = /\b\d{1,2}\.\s*(január\w*|febru[áa]r\w*|marec|marca|apríl\w*|máj|mája|jún\w*|júl\w*|august\w*|september\w*|okt[óo]ber\w*|november\w*|december\w*)/iu;
const ZAHRADA_INVAZNE_RE = /(?<![\p{L}])(pajase[ňn]\w*|boľševník\w*|krídlatk\w*|zlatobyľ\w*|netýkavk\w*\s+žliazkat\w*)/iu;
const ZAHRADA_USMRTENIE_RE = /(?<![\p{L}])(otráv\w*|usmrti\w*|zabi(ť|te)\w*|vyhubi\w*|jedovat[áé]\s+n[áa]sad\w*)/iu;
// Úzko na kúpny imperatív — NIE na "odporúčame"/"zvážte" (bežné editorské
// slová v návode), presne to, čo generickému ADVICE_RE chýbalo.
const ZAHRADA_KUP_RE = /(?<![\p{L}])(kúpte|nakúpte|zaobstarajte\s+si|obstarajte\s+si)\s/iu;

const ZAHRADA_CHECKS = [
  {
    id: 'zdroje',
    run: ({ article }) => (article.sources ?? []).length === 0 ? 'článok nemá ani jeden zdroj' : null,
  },
  {
    id: 'pripravky',
    run: ({ article }) => {
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      const hit = body.match(ZAHRADA_PRIPRAVOK_RE);
      return hit ? `konkrétny prípravok/dávkovanie: „${hit[0]}" — smie byť len všeobecný odkaz na register ÚKSÚP` : null;
    },
  },
  {
    id: 'huby',
    run: ({ article }) => {
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      const hit = body.match(ZAHRADA_HUBY_RE);
      return hit ? `zmienka o hubách: „${hit[0]}" — huby sa v tejto rubrike nespracúvajú vôbec` : null;
    },
  },
  {
    id: 'zdravotné-tvrdenia',
    run: ({ article }) => {
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      const hit = body.match(ZAHRADA_ZDRAVIE_RE);
      return hit ? `zdravotné tvrdenie o rastline: „${hit[0]}" — bylinka je rastlina, nie liek` : null;
    },
  },
  {
    id: 'presný-dátum',
    run: ({ article }) => {
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      const hit = body.match(ZAHRADA_DATUM_RE);
      return hit ? `presný kalendárny dátum: „${hit[0]}" — termín patrí viazať na fázu rastliny alebo teplotu` : null;
    },
  },
  {
    id: 'invázny-druh',
    run: ({ article }) => {
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      const hit = body.match(ZAHRADA_INVAZNE_RE);
      return hit ? `zmienka o invázom druhu: „${hit[0]}" — over, že text ho neodporúča vysadiť (nariadenie EÚ 1143/2014)` : null;
    },
  },
  {
    id: 'usmrtenie-stavovca',
    run: ({ article }) => {
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      const hit = body.match(ZAHRADA_USMRTENIE_RE);
      return hit ? `možné usmrtenie stavovca: „${hit[0]}" — pri kroch/vtákoch/hlodavcoch len odpudzovanie` : null;
    },
  },
  {
    id: 'kúpna-výzva',
    run: ({ article }) => {
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      const hit = body.match(ZAHRADA_KUP_RE);
      return hit ? `výzva na kúpu: „${hit[0].trim()}"` : null;
    },
  },
];

// Zoznam kontrol. Každá vráti null (ok) alebo text dôvodu (zamietnuté).
const CHECKS = [
  {
    id: 'zdroje',
    run: ({ article }) => {
      const s = article.sources ?? [];
      if (s.length === 0) return 'článok nemá ani jeden zdroj';
      const bezMena = s.filter((x) => !x?.name).length;
      if (bezMena > 0) return `${bezMena} zdroj(ov) bez názvu`;
      return null;
    },
  },
  {
    id: 'atribúcia',
    run: ({ article, facts }) => {
      // Ak ktorýkoľvek fakt pochádza zo sekundárneho média, text MUSÍ povedať „podľa X".
      if (facts?.attribution_required !== true) return null;
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      if (!/\bpodľa\b/i.test(body)) return 'fakty vyžadujú atribúciu, ale v texte nie je „podľa …"';
      // Aspoň jeden sekundárny zdroj musí byť v texte menovaný.
      const sekundarne = (article.sources ?? []).filter((s) => s.type === 'secondary');
      if (sekundarne.length === 0) return null;   // nič sekundárne → stačí samotné „podľa"
      const menovany = sekundarne.some((s) => s.name && body.includes(s.name));
      if (!menovany) {
        return `sekundárny zdroj nie je v texte menovaný (${sekundarne.map((s) => s.name).join(', ')})`;
      }
      return null;
    },
  },
  {
    id: 'citácie',
    run: ({ facts }) => {
      const dlhe = (facts?.facts ?? []).filter(
        (f) => f.kind === 'quote' && String(f.statement ?? '').length > MAX_QUOTE_CHARS,
      );
      if (dlhe.length) return `citácia dlhšia než ${MAX_QUOTE_CHARS} znakov (${dlhe.length}×) — nad rámec fair use`;
      return null;
    },
  },
  {
    id: 'investičné-poradenstvo',
    run: ({ article }) => {
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      const hit = body.match(ADVICE_RE);
      if (hit) return `text obsahuje investičné odporúčanie: „${hit[0]}"`;
      const rada = body.match(CONSUMER_ADVICE_RE);
      if (rada) return `text radí čitateľovi, čo má robiť s peniazmi: „${rada[0]}"`;
      return null;
    },
  },
];

// Ktorý profil kontrol platí pre danú položku. Sekcia sa hľadá na oboch
// miestach, kde v pipeline zvykne bývať (article.section prednostne —
// rovnaké poradie, aké používa 12-publisher pri categoryFor()).
function checksFor(article, facts) {
  const section = article?.section ?? facts?.section;
  return section === 'zahrada' ? ZAHRADA_CHECKS : CHECKS;
}

// ---------- Spracuj JEDEN článok ----------
// dryRun: prebehne checklist a vráti výsledok, ale NEZAPÍŠE do fronty.
export async function run(item, { dryRun = false } = {}) {
  const article = item.article;
  if (!article?.headline || !article?.body) {
    throw new Error('item.article chýba headline/body');
  }
  const ctx = { article, facts: item.facts ?? {} };
  const checks = checksFor(article, item.facts);

  const problemy = [];
  for (const check of checks) {
    const dovod = check.run(ctx);
    if (dovod) problemy.push(`${check.id}: ${dovod}`);
  }

  if (problemy.length) {
    if (!dryRun) await advance(item.id, 'rejected', { error: `${AGENT}: ${problemy.join(' | ')}` });
    return { ok: false, problemy };
  }

  const checked = {
    ...article,
    legal: { passed: checks.map((c) => c.id), at: new Date().toISOString() },
  };
  if (!dryRun) await advance(item.id, STAGE.output, { article: checked });
  return { ok: true, problemy: [] };
}

// ---------- Dávka ----------
export async function runBatch(limit = 30) {
  const items = await claim(STAGE.input, limit);
  const res = { ok: 0, zamietnute: 0, failed: 0 };
  for (const item of items) {
    try {
      const r = await run(item);
      if (r.ok) res.ok++; else res.zamietnute++;
    } catch (err) {
      res.failed++;
      await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return res;
}
