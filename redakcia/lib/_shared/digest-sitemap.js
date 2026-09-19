// SITEMAP AKO ZDROJ PRE PREHĽAD SPRÁV — pre weby bez RSS (Anthropic news,
// Claude blog, xAI, ElevenLabs, Cohere, Scale AI, darioamodei.com, Ledger
// blog, OFAC, Fortune Crypto, DL News — overené naživo 15.-16. 9. 2026).
//
// AKO TO FUNGUJE: prečíta Sitemap: riadky z robots.txt, BFS cez prípadné
// sitemapindexy (strop MAX_SITEMAPS, nech jeden web nezožerie celý beh),
// vráti adresy zodpovedajúce `hint` (podreťazec cesty, napr. "/news/").
// Dátum (`lastmod`) je LEN DOPLNKOVÁ informácia — pri viacerých weboch
// (zistené 15. 9. na Anthropic) je nespoľahlivý, takže ČERSTVOSŤ TU RIADI
// NOVOSŤ ADRESY (seen-state v digest.mjs), nie lastmod.
//
// TITULOK SA NEŤAHÁ TU — sitemap ho nedáva. digest.mjs si ho dotiahne
// LEN pre položky, čo naozaj prejdú výberom (SECTION_CAP), rovnaký princíp
// ako preklad „až teraz, nie za všetkých kandidátov".

const UA = process.env.FEED_USER_AGENT ?? 'NovinkoRedakcia/0.1 mikrofreedom@gmail.com';
const FETCH_TIMEOUT_MS = 12000;
const MAX_SITEMAPS = 12; // koľko jednotlivých sitemap súborov najviac prečítať na zdroj

// NÁJDENÉ 16. 9.: viacjazyčné weby (Claude blog, ElevenLabs) majú v sitemape
// ten istý článok pod /ja/blog/…, /fr/blog/…, /pt/blog/… atď. — bez tohto
// filtra sa jeden článok objavil v prehľade 7-9×. Jazykový prefix vyzerá
// vždy rovnako (2 písmená, voliteľne -XX región) hneď za doménou.
// -[a-z]{2,4} pokrýva aj skriptové varianty ako zh-Hans/zh-Hant (nájdené na
// Ledgeri 16. 9.), nielen bežné dvojpísmenové regióny (pt-BR).
const LOCALE_PREFIX_RE = /^\/[a-z]{2}(-[a-z]{2,4})?\//i;

// Bežné nečlánkové cesty pod /blog/, /news/ a pod. (autor, štítok, kategória,
// stránkovanie) — nájdené 16. 9. na ElevenLabs (/blog/authors/…).
const NECLANKOVA_CESTA_RE = /\/(authors?|tags?|categor(y|ies)|page)\//i;

async function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function robotsSitemaps(origin) {
  const body = await fetchText(`${origin}/robots.txt`);
  if (!body) return [`${origin}/sitemap.xml`]; // slušný odhad, keď robots.txt chýba/zlyhá
  const found = [...body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  return found.length ? found : [`${origin}/sitemap.xml`];
}

// Vráti [{url, lastmod|null}], len tie zodpovedajúce `hint`.
export async function fetchSitemapUrls(originUrl, hint) {
  const origin = originUrl.replace(/\/$/, '');
  const startSitemaps = await robotsSitemaps(origin);
  const seen = new Set();
  const queue = [...startSitemaps];
  const out = [];

  while (queue.length && seen.size < MAX_SITEMAPS) {
    const sm = queue.shift();
    if (seen.has(sm)) continue;
    seen.add(sm);
    const body = await fetchText(sm);
    if (!body) continue;
    const head = body.slice(0, 3000).toLowerCase();
    if (head.includes('<sitemapindex')) {
      const kids = [...body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
      // Uprednostni podsitemapy, ktorých NÁZOV už vyzerá na obsah (news/blog/…),
      // nech sa strop MAX_SITEMAPS minie na relevantné, nie na prvé v poradí.
      const relevant = kids.filter((k) => /news|blog|post|article|announce|press|newsroom/i.test(k));
      for (const k of (relevant.length ? relevant : kids)) if (!seen.has(k)) queue.push(k);
    } else {
      for (const blk of body.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
        const locM = blk[1].match(/<loc>\s*([^<]+?)\s*<\/loc>/);
        if (!locM) continue;
        const url = locM[1];
        if (hint && !url.includes(hint)) continue;
        let pathname;
        try { pathname = new URL(url).pathname; } catch { pathname = ''; }
        if (LOCALE_PREFIX_RE.test(pathname)) continue; // jazyková mutácia — preskočiť, anglická/predvolená verzia stačí
        if (NECLANKOVA_CESTA_RE.test(pathname)) continue; // stránka autora/štítku/kategórie, nie článok
        const lmM = blk[1].match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/);
        out.push({ url, lastmod: lmM ? lmM[1] : null });
      }
    }
  }
  return out;
}

// Titulok stránky — volané LEN pre položky, čo prešli výberom (viď digest.mjs).
export async function fetchPageTitle(url) {
  const body = await fetchText(url, 8000);
  if (!body) return null;
  const m = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, ' ').trim() || null;
}
