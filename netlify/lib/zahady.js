// Jediný kontrakt pre ručne publikované články rubriky Záhady a fenomény.
// Verejné metadáta sú v stĺpci J hárku articles; staršie riadky majú J prázdne.
const SUBCATEGORIES = Object.freeze({
  zahady: 'Záhady sveta',
  miesta: 'Tajomné miesta',
  historia: 'História a archeológia',
  javy: 'Nevysvetlené javy',
  vesmir: 'Vesmír a neznámo',
  uap: 'UFO a UAP',
  legendy: 'Legendy a folklór',
  povery: 'Povery a tradície',
  magia: 'Mágia',
  ezoterika: 'Ezoterika',
  sny: 'Sny a symbolika',
  astrologia: 'Astrológia',
  tarot: 'Tarot',
  numerologia: 'Numerológia',
});

const CONTENT_TYPES = Object.freeze({
  F: 'Faktografický článok',
  M: 'Záhada',
  H: 'Hypotéza',
  L: 'Legenda alebo tradícia',
  E: 'Ezoterický výklad',
  N: 'Nový objav',
});

const SERIES = Object.freeze({
  slovensko: 'Tajomné Slovensko',
  europa: 'Záhady Európy',
  svet: 'Záhady sveta',
  tyzden: 'Záhada týždňa',
});

function clean(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function validHttpUrl(value) {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password;
  } catch { return false; }
}

function validArticleImageUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    if (/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname)) return true;
    return u.hostname === 'novinko.sk' && !u.search && !u.hash
      && /^\/assets\/zahady\/clanky\/[a-z0-9-]+\.webp$/.test(u.pathname);
  } catch { return false; }
}

function parseMeta(value) {
  try {
    const data = typeof value === 'string' ? JSON.parse(value || '{}') : value;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}

function normalizeTopic(value) {
  return clean(value, 300).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const GENERIC_WORDS = new Set([
  'zahada','zahady','tajomstvo','tajomny','tajomna','tajomne','pripad','pribeh','historia',
  'legenda','povest','co','sa','stalo','ako','preco','o','v','vo','na','z','zo','a','the',
  'lode','lod','posadke','posadka','miesta','miesto',
]);
function topicFingerprint(value) {
  return normalizeTopic(value).split(' ').filter((word) => word.length > 2 && !GENERIC_WORDS.has(word)).join(' ');
}
function sameTopic(a, b) {
  const x = normalizeTopic(a);
  const y = normalizeTopic(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const fx = topicFingerprint(x);
  const fy = topicFingerprint(y);
  return fx && fy && fx === fy && fx.split(' ').length >= 2;
}

function list(value, maxItems = 12) {
  return [...new Set(String(value ?? '').split(/[,\n]/).map((item) => clean(item, 100)).filter(Boolean))].slice(0, maxItems);
}

function validateMystery(data) {
  const subcategory = clean(data.subcategory, 40);
  const contentType = clean(data.contentType, 2);
  const series = clean(data.series, 40);
  const canonicalTopic = clean(data.canonicalTopic, 180);
  const imageKind = clean(data.imageKind, 20);
  if (!SUBCATEGORIES[subcategory]) throw new Error('Vyber platnú podkategóriu.');
  if (!CONTENT_TYPES[contentType]) throw new Error('Vyber platný typ článku.');
  if (series && !SERIES[series]) throw new Error('Vyber platnú sériu.');
  if (canonicalTopic.length < 4) throw new Error('Zadaj kanonický názov témy.');
  if (!['photo', 'archive', 'ai', 'illustration'].includes(imageKind)) {
    throw new Error('Vyber pôvod titulného obrázka.');
  }
  const rawSources = Array.isArray(data.sources) ? data.sources : [];
  if (rawSources.length < 1 || rawSources.length > 12) throw new Error('Zadaj 1 až 12 zdrojov.');
  const sources = rawSources.map((source) => ({
    name: clean(source?.name, 160), url: clean(source?.url, 1000),
  }));
  if (sources.some((source) => !source.name || !validHttpUrl(source.url))) {
    throw new Error('Každý zdroj potrebuje názov a platný odkaz.');
  }
  const aliases = list(data.topicAliases);
  const seoTitle = clean(data.seoTitle, 100);
  const metaDescription = clean(data.metaDescription, 200);
  const focusKeyword = clean(data.focusKeyword, 100);
  const secondaryKeywords = list(data.secondaryKeywords);
  const tags = list(data.tags);
  const newAngleReason = clean(data.newAngleReason, 500);
  return {
    version: 1, subcategory, contentType, series, canonicalTopic, aliases,
    country: clean(data.country, 100), location: clean(data.location, 160),
    historicalPeriod: clean(data.historicalPeriod, 100),
    persons: list(data.persons), mainEntities: list(data.mainEntities),
    focusKeyword, secondaryKeywords, tags, newAngleReason,
    imageKind, sources, seoTitle, metaDescription,
  };
}

module.exports = { SUBCATEGORIES, CONTENT_TYPES, SERIES, parseMeta, normalizeTopic, sameTopic, validateMystery, validArticleImageUrl };
