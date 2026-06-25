// Ochrana generujúcich funkcií pred verejným zneužitím (míňanie API kreditu).
// Pustí request len ak:
//  1) prišiel od Netlify cronu (telo obsahuje "next_run"), alebo
//  2) má správny CRON_SECRET (hlavička x-cron-secret alebo ?secret=...), alebo
//  3) beží lokálne (netlify dev / node test.js — nie produkcia).
function isAuthorized(event) {
  // 3) lokálne prostredie => povoľ (test.js, netlify dev)
  if (process.env.NETLIFY_DEV === "true") return true;
  if (!process.env.NETLIFY) return true; // mimo Netlify runtime = lokálny node

  // 1) Netlify scheduled invokácia => telo má next_run
  try {
    if (event && event.body) {
      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      if (body && body.next_run) return true;
    }
  } catch { /* telo nie je JSON => pokračuj na token */ }

  // 2) správny token
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // ak secret nie je nastavený, radšej zamietni
  const headers = (event && event.headers) || {};
  const headerSecret = headers["x-cron-secret"] || headers["X-Cron-Secret"];
  const qs = (event && event.queryStringParameters) || {};
  const querySecret = qs.secret;
  return headerSecret === expected || querySecret === expected;
}

// Vráti null ak je autorizované, inak HTTP 401 response.
function denyIfUnauthorized(event) {
  if (isAuthorized(event)) return null;
  return {
    statusCode: 401,
    body: JSON.stringify({ error: "Unauthorized" }),
  };
}

module.exports = { isAuthorized, denyIfUnauthorized };
