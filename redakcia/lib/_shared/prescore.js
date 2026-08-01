// PREDBEŽNÉ SKÓRE — lacné sito PRED drahou extrakciou faktov (05).
//
// PREČO VZNIKLO (2026-08-01): poradie krokov bolo
//   04-collector → 05-verification (AI na KAŽDEJ položke) → 06-chief-editor (brána)
// teda drahá extrakcia bežala PRED bránou, ktorá 90 % vecí zahodí. V nákladovom
// logu to vyzeralo takto: 851 volaní 05 = $2.49 = 75.9 % celého rozpočtu,
// pritom z nich vzniklo 83 článkov. Deväť z desiatich extrakcií sa zaplatilo
// za položku, ktorá sa článkom nikdy nestala.
//
// Tu sa preto rozhodne, ktoré položky si drahú extrakciu vôbec zaslúžia.
// Žiadne AI — len metadáta, ktoré máme zadarmo ešte pred spracovaním:
// zdroj, vrstva, entita, titulok, dĺžka textu. „Software First, AI Second."
//
// Skóre NIE JE dôležitosť správy — tú počíta až importance.js z faktov.
// Toto je len hrubé poradie „čo spracovať skôr, keď nemôžeme všetko".

// Slová v titulku, ktoré spoľahlivo predznamenávajú spravodajskú hodnotu.
// Zámerne konzervatívne: radšej prepustiť viac než uškrtiť tému.
const SIGNAL = [
  // regulácia a právo
  [/\b(sec|esma|mica|regulat|lawsuit|court|fine|sanction|ban|approv)/i, 18],
  // bezpečnosť
  [/\b(hack|exploit|breach|stolen|drain|vulnerab|attack)/i, 20],
  // trhové udalosti
  [/\b(etf|listing|delist|halving|upgrade|mainnet|launch|fork)/i, 14],
  // firemné
  [/\b(acqui|merger|partnership|funding|raise|bankrupt|insolven)/i, 12],
  // výklad trhu (to, kvôli čomu sme pridali research desky)
  [/\b(outflow|inflow|liquidat|selloff|rally|drawdown|volatil)/i, 12],
];

// Blogy búrz sú ZMIEŠANÉ: popri výskume tam ide prevádzka a marketing.
// Bez tohto by príznak `desk` (+40) vytlačil nahor „xU3O8 is available for
// trading!" a „Delisting of Illiquid Contracts", zatiaľ čo skutočná analýza
// („Is MSTR Stock a Buy? What the mNAV at a 52-Week Low Is Really…") by
// vypadla pod strop — overené na živej fronte 2026-08-01.
// Na rozdiel od SIGNAL sa tieto SČÍTAVAJÚ: viac znakov šumu = tvrdší postih.
const NOISE = [
  [/\b(available for trading|now available|now live|introducing|we[''`]?re excited|coming soon)/i, -35],
  [/\b(delisting|delisted|removal of|suspension|scheduled maintenance|important (notice|message))/i, -30],
  [/\b(deposits? and withdrawals?|convert support|trading competition|airdrop campaign)/i, -25],
];

// Naopak: čo vyzerá na skutočný analytický materiál.
const RESEARCH = [
  /\b(report|analysis|analytics|outlook|research|deep ?dive|what .{3,30} means|why\b)/i,
];

export function prescore(rd = {}) {
  let score = 0;
  const reasons = [];
  const add = (n, why) => { score += n; reasons.push(`${why} +${n}`); };

  // Research desk = jediný zdroj, ktorý nesie PREČO (viď feeds.js).
  // Najvyššia váha: presne kvôli nemu sme celú vetvu stavali.
  if (rd.desk === true) add(40, 'desk');

  if (rd.layer === 'B') add(12, 'layer B');
  else if (rd.layer === 'C') add(8, 'layer C');

  // Známy subjekt = vieme, o čom to je, ešte pred extrakciou.
  if (rd.entity) add(10, 'entita');

  const title = String(rd.title ?? '');
  for (const [re, body] of SIGNAL) {
    if (re.test(title)) { add(body, 'titulok'); break; }   // len najsilnejší zásah
  }
  // Prevádzka a marketing — postihy sa sčítavajú.
  for (const [re, body] of NOISE) {
    if (re.test(title)) add(body, 'šum');
  }
  // Analytický materiál — to, kvôli čomu sme desky pridávali.
  if (RESEARCH.some((re) => re.test(title))) add(20, 'výskum');

  // Dlhší text = viac materiálu na článok. Strop, nech dĺžka neprebije obsah.
  const dlzka = String(rd.text ?? '').length;
  if (dlzka > 2000) add(10, 'dlhý text');
  else if (dlzka > 800) add(6, 'stredný text');
  else if (dlzka < 200) add(-8, 'takmer bez textu');

  // Sekundárny zdroj potrebuje atribúciu a býva prerozprávaním → nižšia priorita.
  if (rd.source_type === 'secondary') add(-5, 'sekundárny');

  return { score, reasons };
}
