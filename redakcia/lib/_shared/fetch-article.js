// CELÝ ČLÁNOK ZO ZDROJA — keď RSS súhrn je príliš krátky na extrakciu faktov.
// Právne hranice (nemenné):
//   - Rešpektuje robots.txt (ak zakazuje, nesťahuje).
//   - Čestný User-Agent (rovnaká identita ako rss.js), žiadne obchádzanie blokov.
//   - Výstup tejto funkcie sa NIKDY neukladá do databázy — použije sa LEN
//     dočasne v pamäti ako vstup pre 05-verification (Fact Extractor), ktorý
//     ho aj tak premení na atomické, prefrázované fakty. Von idú len fakty.
//   - Zlyhanie (blok, timeout, paywall) je nefatálne — volajúci padne späť
//     na krátky RSS text, nič sa nerozbije.

const UA = process.env.FEED_USER_AGENT ?? 'NovinkoRedakcia/0.1 mikrofreedom@gmail.com';
const FETCH_TIMEOUT_MS = 8000;
const MAX_CHARS = 6000; // strop na dĺžku (náklady na AI + rozumná veľkosť vstupu)

const _robotsCache = new Map(); // domain -> { disallowAll, disallowedPaths[] } | null (chyba/žiadny robots.txt)

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': UA, ...opts.headers } });
  } finally {
    clearTimeout(t);
  }
}

// Veľmi jednoduchý robots.txt parser — rieši "User-agent: *" + "Disallow: /path".
// Nie je to plná implementácia špecifikácie, ale je to čestný pokus rešpektovať zákaz.
async function getRobotsRules(origin) {
  if (_robotsCache.has(origin)) return _robotsCache.get(origin);
  let rules = { disallowAll: false, disallowedPaths: [] };
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`);
    if (res.ok) {
      const body = await res.text();
      let inWildcardGroup = false;
      for (const rawLine of body.split('\n')) {
        const line = rawLine.split('#')[0].trim();
        if (!line) continue;
        const [key, ...rest] = line.split(':');
        const value = rest.join(':').trim();
        if (/^user-agent$/i.test(key)) inWildcardGroup = value === '*';
        else if (inWildcardGroup && /^disallow$/i.test(key) && value) {
          if (value === '/') rules.disallowAll = true;
          else rules.disallowedPaths.push(value);
        }
      }
    }
  } catch {
    // žiadny/nedostupný robots.txt → žiadne dodatočné obmedzenie
  }
  _robotsCache.set(origin, rules);
  return rules;
}

async function isAllowedByRobots(urlStr) {
  try {
    const u = new URL(urlStr);
    const rules = await getRobotsRules(u.origin);
    if (rules.disallowAll) return false;
    return !rules.disallowedPaths.some((p) => u.pathname.startsWith(p));
  } catch {
    return true; // nevalidná URL a pod. — nech to padne na inom mieste
  }
}

// Heuristické (bez závislostí) vytiahnutie čitateľného textu z HTML:
// zahoď script/style/nav/header/footer/aside/form, potom všetky značky.
function extractReadableText(html) {
  let s = html
    .replace(/<(script|style|noscript|nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return s.replace(/\s+/g, ' ').trim();
}

// Vráti čitateľný text stránky, alebo null (zakázané/zlyhalo — volajúci nech
// použije krátky RSS text namiesto toho).
export async function fetchFullArticleText(url) {
  if (!url) return null;
  try {
    if (!(await isAllowedByRobots(url))) return null;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) return null;
    const html = await res.text();
    const text = extractReadableText(html);
    return text.length > 200 ? text.slice(0, MAX_CHARS) : null;
  } catch {
    return null;
  }
}
