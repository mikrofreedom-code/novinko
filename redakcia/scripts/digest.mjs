// PREHĽAD SPRÁV — súkromný radar pre používateľa, NIE produkčná pipeline.
// ------------------------------------------------------------
//   node --env-file=.env scripts/digest.mjs [--lookback=24] [--dry]
//
// ČO ROBÍ: stiahne zdroje z lib/_shared/digest-feeds.js — RSS/Atom feedy
// (DIGEST_FEEDS) aj weby bez RSS sledované cez sitemap (DIGEST_SITEMAP_SOURCES,
// doplnené 16. 9. — Anthropic news, Claude blog, xAI, ElevenLabs, Cohere,
// Scale AI, darioamodei.com, Ledger, OFAC, Fortune Crypto, DL News; ich
// čerstvosť riadi NOVOSŤ ADRESY, nie dátum, viď lib/_shared/digest-sitemap.js).
// Vynechá položky staršie než lookback okno a tie, ktoré už v minulom behu
// UKÁZAL (nie len stiahol — viď nižšie), zvyšok rozdelí po sekciách a pošle
// ako SAMOSTATNÉ správy do TELEGRAM_DIGEST_BOT_TOKEN/CHAT_ID — iný bot než
// schvaľovací (TELEGRAM_BOT_TOKEN), aby sa prehľad nemiešal s ✅/❌ na články.
//
// VÝBER V RÁMCI SEKCIE (rozhodnuté 15. 9.): P1 (primárny zdroj) sa ukáže VŽDY
// celé, P2 a P3 dopĺňajú zvyšok do SECTION_CAP (default 20) — najnovšie prvé.
// Kandidát, ktorého strop v danom behu vynechal, NIE JE označený za videný —
// ostáva kandidátom na ďalší beh (kým je v okne lookbacku), takže tenký deň
// na P1 nepripraví P2 o šancu natrvalo.
//
// Kým TELEGRAM_DIGEST_BOT_TOKEN/CHAT_ID nie sú v .env (alebo pri --dry),
// všetko len vypíše do konzoly.
//
// PREKLAD (DIGEST_TRANSLATE=true, rozhodnuté 15. 9.): jedno dávkové volanie
// Haiku na SEKCIU (nie na položku), AŽ PO výbere cez SECTION_CAP — platí sa
// len za nadpisy, ktoré sa naozaj ukážu. ZÁMERNE nezávislé od AI_ENABLED
// (ten vypína len produkčnú pipeline 05-17, nie tento skript) — takže funguje
// aj keď je zvyšok redakcie vypnutý pre nulový kredit. Keď zlyhá (napr.
// naozaj nulový kredit), nadpis ostane po anglicky, beh sa nezastaví.
//
// CENA: bez prekladu $0. S prekladom ~$0,012 na beh (4 sekcie, Haiku 4.5,
// odhad 15. 9.) — loguje sa do ai_cost_log pod agentom 'digest-preklad',
// vidno v scripts/rozpocet.mjs. Rovnaký rozpočtový strop ako produkcia
// (ai-gateway.js), takže sa nedá minúť viac, než dovoľuje DAILY_BUDGET_USD.
//
// ČO TU ZÁMERNE NIE JE: zápis do queue/Supabase, tlačidlá „spracuj toto“
// (vyžadovali by pollovanie Telegram getUpdates alebo webhook — ďalší krok,
// až kým nebude jasné, že objem a kvalita prehľadu stoja za to zapojiť ho
// do frontu na spracovanie).

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchFeed } from '../lib/_shared/rss.js';
import { DIGEST_FEEDS, DIGEST_SITEMAP_SOURCES } from '../lib/_shared/digest-feeds.js';
import { fetchSitemapUrls, fetchPageTitle } from '../lib/_shared/digest-sitemap.js';
import { askFull } from '../lib/_shared/ai-gateway.js';
import { parseModelJson } from '../lib/_shared/json.js';

// Zjednotený zoznam zdrojov — RSS aj sitemap majú spoločný tvar {section,
// tier, name, url, kind}, aby zvyšok skriptu (seen-state, SECTION_CAP,
// preklad) nemusel vedieť, odkiaľ položka prišla. Sitemap zdroje majú
// `url` = origin (rovnaká sémantika ako pri RSS `url` = adresa feedu — je to
// to, čím sa identifikuje ZDROJ, nie jednotlivá položka).
const ALL_SOURCES = [
  ...DIGEST_FEEDS.map((f) => ({ ...f, kind: 'rss' })),
  ...DIGEST_SITEMAP_SOURCES.map((s) => ({ ...s, kind: 'sitemap', url: s.origin })),
];

// PREKLAD NADPISOV (rozhodnuté 15. 9.) — VOLITEĽNÝ, cez ten istý ai-gateway.js
// ako zvyšok redakcie (rozpočtový strop, záznam do ai_cost_log pod agentom
// 'digest-preklad'). ZÁMERNE nekontroluje AI_ENABLED — to je vypínač pre
// PRODUKČNÚ pipeline (05-17), tento skript je od nej nezávislý. Ak preklad
// zlyhá (napr. nulový kredit na účte), nadpis sa ukáže po anglicky —
// zlyhanie prekladu nikdy nezastaví celý beh, viď translateTitles() nižšie.
const TRANSLATE = process.env.DIGEST_TRANSLATE === 'true';
const TRANSLATE_SYSTEM = 'Si profesionálny prekladateľ titulkov spravodajstva '
  + 'z angličtiny do slovenčiny. Preklad musí byť prirodzený, krátky, bez '
  + 'zmeny významu. Vráť VÝHRADNE JSON pole reťazcov, presne v tomto poradí '
  + 'a v rovnakom počte ako vstup, bez akéhokoľvek ďalšieho textu.';

let prekladZlyhal = false;
async function translateTitles(sectionId, items) {
  if (!items.length) return items;
  const povodne = items.map((it) => it.title || '(bez nadpisu)');
  try {
    const { text } = await askFull({
      tier: 'cheap',
      section: sectionId,
      agent: 'digest-preklad',
      system: TRANSLATE_SYSTEM,
      prompt: JSON.stringify(povodne),
      maxTokens: Math.min(4000, povodne.length * 60 + 200),
      temperature: 0.2,
    });
    const parsed = parseModelJson(text);
    if (!parsed.ok || !Array.isArray(parsed.value) || parsed.value.length !== items.length) {
      console.log(`  ⚠️  preklad ${sectionId}: neplatná odpoveď (${parsed.ok ? `dĺžka ${parsed.value?.length}` : parsed.chyba}) — nadpisy ostávajú po anglicky`);
      prekladZlyhal = true;
      return items;
    }
    return items.map((it, i) => ({ ...it, title: String(parsed.value[i] ?? it.title) }));
  } catch (e) {
    console.log(`  ⚠️  preklad ${sectionId} zlyhal (${e.message}) — nadpisy ostávajú po anglicky`);
    prekladZlyhal = true;
    return items;
  }
}

// NÁJDENÉ pri prvom ostrom behu (15. 9.): rss-parser má vlastný `timeout`,
// ale pri zaseknutom spojení (spojenie sa otvorí, dáta neprídu) ho niekedy
// nezachytí — celý beh vtedy visel 8+ minút na 3 mŕtvych socketoch. Vlastný
// tvrdý strop cez Promise.race funguje nezávisle od knižnice.
const HARD_FETCH_TIMEOUT_MS = 20000;
function withHardTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`tvrdý timeout ${ms} ms`)), ms)),
  ]);
}

const ARGS = process.argv.slice(2);
const LOOKBACK_H = Number((ARGS.find((a) => a.startsWith('--lookback=')) ?? '').split('=')[1] ?? process.env.DIGEST_LOOKBACK_HOURS ?? 24);
const DRY = ARGS.includes('--dry');
// Poistka (nájdené 15. 9.: arXiv cs.AI samo tvorilo 71 % AI sekcie, kým sme
// ho nevyradili) — žiadny JEDEN zdroj nesmie v jednom behu zaplaviť sekciu.
// arXiv je preto vonku úplne (viď digest-feeds.js), toto je poistka pre
// prípad, že sa nabudúce pridá iný rovnako plodný zdroj.
const MAX_PER_FEED = Number(process.env.DIGEST_MAX_PER_FEED ?? 25);
// Rozhodnuté 15. 9.: P1 (primárny zdroj) sa ukáže VŽDY celé, bez orezania —
// P2/P3 dopĺňajú zvyšok do tohto stropu. Svet má len 5 P1 zdrojov a tie
// publikujú zriedka (OSN, IAEA, WHO…) — bez P2 (BBC, Guardian…) by bol
// prázdny, hoci to je presne sekcia, kde je P2 skutočný obsah, nie doplnok.
const SECTION_CAP = Number(process.env.DIGEST_SECTION_CAP ?? 20);

const SECTIONS = [
  { id: 'ai', label: '🤖 AI' },
  { id: 'krypto', label: '🪙 Krypto' },
  { id: 'svet', label: '🌍 Svet' },
  { id: 'ekonomika', label: '📊 Ekonomika' },
];
const TIER_ICON = { P1: '🔴', P2: '🔵', P3: '🟡', P4: '🟣' };

// ── lokálny stav (aké guidy sme už raz ukázali) — rovnaký atomický vzor ako
// lib/flow/16-horoskop.js (dočasný súbor → rename, ranný beh nikdy neuvidí
// polovicu JSON-u) ──
const STATE_DIR = fileURLToPath(new URL('../drafts/prehlad-spravy/', import.meta.url));
const STATE_PATH = STATE_DIR + 'stav.json';
const SEEN_CAP_PER_FEED = 500; // koľko guidov na feed si pamätať, nech súbor nerastie donekonečna

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8'));
  } catch {
    return { seen: {} }; // prvý beh — nič sme ešte neposlali
  }
}
async function saveState(state) {
  await mkdir(STATE_DIR, { recursive: true });
  const tmp = STATE_PATH + '.tmp';
  await writeFile(tmp, JSON.stringify(state, null, 1));
  await rename(tmp, STATE_PATH);
}

// ── stiahnutie so slušnou paralelnosťou (nezaťažiť žiadny jeden web, nezhltnúť pamäť) ──
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── stiahni KAŽDÝ ZDROJ LEN RAZ (kľúč: kind+url, nech sitemap origin nikdy
// nekolíduje s RSS adresou zhodou náhod) ──
// Niektoré adresy (FT, SCMP) sú v DIGEST_FEEDS zámerne pod viacerými sekciami
// naraz (presne ako vo watchlist zošitoch) — netreba ich sťahovať viackrát.
const unikatneZdroje = [...new Map(ALL_SOURCES.map((f) => [`${f.kind}::${f.url}`, f])).values()];
console.log(`prehľad: sťahujem ${unikatneZdroje.length} unikátnych zdrojov (${ALL_SOURCES.length} riadkov, lookback ${LOOKBACK_H} h)…`);
const stiahnuteMap = new Map(
  (await mapLimit(unikatneZdroje, 10, async (f) => {
    const kluc = `${f.kind}::${f.url}`;
    try {
      let items;
      if (f.kind === 'sitemap') {
        // Sitemap nedáva titulok ani spoľahlivý dátum — čerstvosť tu rieši
        // NOVOSŤ ADRESY (seen-state nižšie), title sa dotiahne až pre
        // vybraté položky (viď fetchPageTitle nižšie, po SECTION_CAP).
        const urls = await withHardTimeout(fetchSitemapUrls(f.url, f.hint), HARD_FETCH_TIMEOUT_MS);
        items = urls.map((u) => ({ guid: u.url, link: u.url, title: null, text: '', published: u.lastmod }));
      } else {
        items = await withHardTimeout(fetchFeed(f.url), HARD_FETCH_TIMEOUT_MS);
      }
      return [kluc, { items, error: null }];
    } catch (e) {
      return [kluc, { items: [], error: e.message }];
    }
  })),
);

const hranica = Date.now() - LOOKBACK_H * 3600_000;
const state = await loadState();

// ── vyber KANDIDÁTOV za sekciu (ešte nie finálny výber — ten robí strop nižšie) ──
// POZOR: „videné" sa pamätá per (sekcia, adresa), NIE len per adresa — inak
// by prvá sekcia, ktorá zdieľanú adresu (FT, SCMP) spracuje, „minula" všetky
// jej položky a ostatné sekcie by z nej nedostali nič (nájdené 15. 9., viď
// komentár pri DIGEST_FEEDS).
//
// DÔLEŽITÉ: guid sa do state.seen zapíše AŽ keď položka naozaj prejde
// stropom sekcie nižšie (SECTION_CAP) — nie tu. Kandidát, ktorý dnes ustúpi
// bohatšiemu P1, tak dostane šancu v ĎALŠOM behu (kým je v okne lookbacku),
// namiesto aby zmizol navždy len preto, že dnes mal smolu na poradie.
// Výnimka: MAX_PER_FEED (jeden zdroj priveľmi plodný) sa označí za videné
// hneď — to je flood guard, nie prioritizácia, viď komentár pri MAX_PER_FEED.
const poSekciach = new Map(SECTIONS.map((s) => [s.id, []]));
const zlyhane = [];
for (const feed of ALL_SOURCES) {
  const { items, error } = stiahnuteMap.get(`${feed.kind}::${feed.url}`);
  if (error) { zlyhane.push({ feed, error }); continue; }
  const stavKluc = `${feed.section}::${feed.url}`;
  const videneTohtoFeedu = new Set(state.seen[stavKluc] ?? []);
  const noveZTohtoFeedu = [];
  for (const it of items) {
    const guid = it.guid || it.link || it.title;
    if (!guid) continue;
    const cas = it.published ? new Date(it.published).getTime() : null;
    const dostatocneCerstve = cas === null ? true : cas >= hranica; // bez dátumu radšej ukázať než stratiť
    if (dostatocneCerstve && !videneTohtoFeedu.has(guid)) {
      noveZTohtoFeedu.push({ ...it, guid, feed, cas, stavKluc });
    }
  }
  noveZTohtoFeedu.sort((a, b) => (b.cas ?? 0) - (a.cas ?? 0));
  const kandidati = noveZTohtoFeedu.slice(0, MAX_PER_FEED);
  const nadStropomFeedu = noveZTohtoFeedu.slice(MAX_PER_FEED);
  for (const it of kandidati) poSekciach.get(feed.section)?.push(it);
  if (nadStropomFeedu.length) {
    console.log(`  ℹ️  ${feed.name}: ${noveZTohtoFeedu.length} nových, ${nadStropomFeedu.length} nad DIGEST_MAX_PER_FEED — natrvalo zahodené (flood guard)`);
    const spojene = [...new Set([...videneTohtoFeedu, ...nadStropomFeedu.map((it) => it.guid)])].slice(0, SEEN_CAP_PER_FEED);
    state.seen[stavKluc] = spojene;
  }
}

// ── STROP NA SEKCIU: P1 celé bez orezania, P2 a P3 dopĺňajú do SECTION_CAP ──
// (rozhodnuté 15. 9. — viď komentár pri SECTION_CAP vyššie)
for (const sec of SECTIONS) {
  const vsetky = poSekciach.get(sec.id) ?? [];
  const podTierom = (t) => vsetky.filter((it) => it.feed.tier === t).sort((a, b) => (b.cas ?? 0) - (a.cas ?? 0));
  const p1 = podTierom('P1');
  const p2 = podTierom('P2');
  const p3 = podTierom('P3');
  let zvysok = Math.max(0, SECTION_CAP - p1.length);
  const vybraneP2 = p2.slice(0, zvysok);
  zvysok = Math.max(0, zvysok - vybraneP2.length);
  const vybraneP3 = p3.slice(0, zvysok);
  let vybrane = [...p1, ...vybraneP2, ...vybraneP3];
  const odrezanych = vsetky.length - vybrane.length;
  if (odrezanych > 0) {
    console.log(`  ℹ️  ${sec.label}: ${odrezanych} kandidátov nad SECTION_CAP (${SECTION_CAP}) tento beh neukázaných — ostávajú kandidátmi na ďalší beh`);
  }
  // sitemap položky nemajú titulok — dotiahni ho AŽ TERAZ, len pre vybraté
  // (rovnaký princíp ako preklad nižšie: neplatiť/nesťahovať za kandidátov,
  // čo sa aj tak neukážu)
  vybrane = await Promise.all(vybrane.map(async (it) => {
    if (it.title) return it;
    const t = await fetchPageTitle(it.link).catch(() => null);
    return { ...it, title: t || it.link };
  }));
  // preklad AŽ TERAZ — platí sa len za to, čo sa naozaj ukáže, nie za celý kandidátny fond
  if (TRANSLATE) vybrane = await translateTitles(sec.id, vybrane);
  poSekciach.set(sec.id, vybrane);
  // zapíš ako videné LEN to, čo sa naozaj ukáže
  for (const it of vybrane) {
    const uz = new Set(state.seen[it.stavKluc] ?? []);
    uz.add(it.guid);
    state.seen[it.stavKluc] = [...uz].slice(0, SEEN_CAP_PER_FEED);
  }
}

// ── formátovanie ──
function formatSection(sec) {
  const polozky = (poSekciach.get(sec.id) ?? [])
    .sort((a, b) => a.feed.tier.localeCompare(b.feed.tier) || (b.cas ?? 0) - (a.cas ?? 0));
  if (!polozky.length) return { text: null, count: 0 };
  const riadky = polozky.map((it, i) => {
    const icon = TIER_ICON[it.feed.tier] ?? '⚪';
    const nadpis = esc(it.title || '(bez nadpisu)').slice(0, 200);
    const odkaz = it.link ? `<a href="${esc(it.link)}">${nadpis}</a>` : nadpis;
    return `${i + 1}. ${icon} ${odkaz}\n    <i>${esc(it.feed.name)}</i>`;
  });
  const hlavicka = `<b>${sec.label} — ${polozky.length} nových</b>`;
  return { text: [hlavicka, ...riadky].join('\n'), count: polozky.length };
}

// Telegram limit 4096 znakov na správu — rozdeľ, ak treba.
function chunkText(text, max = 3900) {
  if (text.length <= max) return [text];
  const riadky = text.split('\n');
  const casti = [];
  let aktualna = '';
  for (const r of riadky) {
    if ((aktualna + '\n' + r).length > max) { casti.push(aktualna); aktualna = r; }
    else aktualna = aktualna ? `${aktualna}\n${r}` : r;
  }
  if (aktualna) casti.push(aktualna);
  return casti.map((c, i) => (casti.length > 1 ? `(${i + 1}/${casti.length})\n${c}` : c));
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_DIGEST_BOT_TOKEN;
  const chat = process.env.TELEGRAM_DIGEST_CHAT_ID;
  if (DRY || !token || !chat) return { skipped: true };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) return { error: j.description || res.status };
  return { sent: true };
}

// ── beh ──
let spolu = 0;
for (const sec of SECTIONS) {
  const { text, count } = formatSection(sec);
  spolu += count;
  if (!text) { console.log(`\n${sec.label}: 0 nových`); continue; }
  console.log(`\n${'─'.repeat(60)}\n${sec.label}: ${count} nových`);
  for (const cast of chunkText(text)) {
    const vysledok = await sendTelegram(cast);
    if (vysledok.skipped) {
      // bez tokenu / --dry: vypíš do konzoly namiesto odoslania (odstráň HTML značky pre čitateľnosť)
      console.log(cast.replace(/<a href="([^"]+)">([^<]*)<\/a>/g, '$2 ($1)').replace(/<\/?[bi]>/g, ''));
    } else if (vysledok.error) {
      console.error(`  ⚠️  Telegram: ${vysledok.error}`);
    } else {
      console.log(`  ✅ odoslané do Telegramu`);
    }
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`SPOLU: ${spolu} nových položiek naprieč ${SECTIONS.length} sekciami`);
if (zlyhane.length) {
  console.log(`\n⚠️  ${zlyhane.length} zdrojov neodpovedalo:`);
  for (const z of zlyhane) console.log(`   ${z.feed.name} (${z.feed.section}): ${z.error}`);
}
const bezTokenu = DRY || !process.env.TELEGRAM_DIGEST_BOT_TOKEN || !process.env.TELEGRAM_DIGEST_CHAT_ID;
if (bezTokenu) {
  console.log(`\nℹ️  TELEGRAM_DIGEST_BOT_TOKEN/CHAT_ID nie sú nastavené (alebo --dry) — vypísané len do konzoly, nič sa neposlalo.`);
}
if (!TRANSLATE) {
  console.log(`Cena tohto behu: $0 (DIGEST_TRANSLATE=false, žiadne AI volanie).`);
} else if (prekladZlyhal) {
  console.log(`Cena tohto behu: $0 (preklad sa pokúsil, ale zlyhal — pozri ⚠️ vyššie; nič sa neúčtuje, keď volanie nedopadne).`);
} else {
  console.log(`Preklad prebehol cez Haiku — skutočný náklad tohto behu je v ai_cost_log pod agentom 'digest-preklad' (over cez scripts/rozpocet.mjs).`);
}

if (!DRY) await saveState(state);

// Promise.race vyššie beh nezastaví, len naň prestane čakať — zaseknuté
// spojenie (viď HARD_FETCH_TIMEOUT_MS vyššie) by inak držalo proces nažive
// donekonečna, lebo Node nekončí, kým visí čo i len jeden socket.
process.exit(0);
