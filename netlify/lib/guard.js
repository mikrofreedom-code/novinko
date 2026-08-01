// Ochrana generujúcich funkcií pred verejným zneužitím (míňanie API kreditu).
//
// AKO TO NA NETLIFY REÁLNE FUNGUJE (overené 2026-08-01 proti živému webu):
//   • Funkcia SO `schedule` v netlify.toml (generate-svet, generate-sport,
//     refresh-feeds) nie je zvonku dostupná — Netlify vráti prázdne 403 už na
//     edge a náš handler sa vôbec nespustí.
//   • Funkcia BEZ `schedule` (generate-krypto — schedule je zakomentovaný od
//     2026-07-05) je normálny verejný endpoint a chráni ju LEN tento súbor.
//
// Preto `next_run` (marker cronového volania Netlify) NIE JE tajomstvo — je to
// verejne známy formát a poslať ho vie ktokoľvek. Predtým tu stačil na
// autorizáciu, takže na generate-krypto sa dalo `curl -d '{"next_run":"x"}'`
// spustiť generovanie a míňať Anthropic + Replicate kredit.
//
// Teraz ho uznávame VÝHRADNE u funkcií, ktoré sú naozaj naplánované — tam ho
// pred cudzím volaním už odchytil edge. Všade inde platí len CRON_SECRET.
// Naplánovaná funkcia to musí povedať sama: denyIfUnauthorized(event, { scheduled: true }).
const crypto = require("crypto");

// Porovnanie tajomstiev odolné voči meraniu času.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isAuthorized(event, { scheduled = false } = {}) {
  // 1) Cronová invokácia Netlify => telo obsahuje next_run.
  //    Len pre naplánované funkcie — inak je to voľný vstup pre kohokoľvek.
  if (scheduled) {
    try {
      if (event && event.body) {
        const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
        if (body && body.next_run) return true;
      }
    } catch { /* telo nie je JSON */ }
  }

  // 2) správny token (hlavička alebo query)
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const h = (event && event.headers) || {};
    const headerSecret = h["x-cron-secret"] || h["X-Cron-Secret"];
    const qs = (event && event.queryStringParameters) || {};
    if (safeEqual(headerSecret, expected) || safeEqual(qs.secret, expected)) return true;
  }

  return false;
}

function denyIfUnauthorized(event, opts) {
  if (isAuthorized(event, opts)) return null;
  return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
}

module.exports = { isAuthorized, denyIfUnauthorized, safeEqual };
