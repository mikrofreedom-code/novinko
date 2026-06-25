// Ochrana generujúcich funkcií pred verejným zneužitím (míňanie API kreditu).
// Princíp: pustíme len ak je volanie PREUKÁZATEĽNE legitímne:
//  1) Netlify scheduled invokácia (telo má "next_run"), alebo
//  2) správny CRON_SECRET (hlavička x-cron-secret alebo ?secret=...).
function isAuthorized(event) {
  // 1) Netlify cron => telo obsahuje next_run
  try {
    if (event && event.body) {
      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      if (body && body.next_run) return true;
    }
  } catch { /* telo nie je JSON */ }

  // 2) správny token (hlavička alebo query)
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const h = (event && event.headers) || {};
    const headerSecret = h["x-cron-secret"] || h["X-Cron-Secret"];
    const qs = (event && event.queryStringParameters) || {};
    if (headerSecret === expected || qs.secret === expected) return true;
  }

  return false;
}

function denyIfUnauthorized(event) {
  if (isAuthorized(event)) return null;
  return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
}

module.exports = { isAuthorized, denyIfUnauthorized };
