// Lokálny test. Spusti napr.:  node test.js generate-krypto
// Predvolene spustí refresh-feeds (poskladá spravodajstvo).
require("dotenv").config();

const name = process.argv[2] || "refresh-feeds";

(async () => {
  try {
    const { handler } = require(`./netlify/functions/${name}`);
    const res = await handler({ queryStringParameters: {} });
    console.log("STATUS:", res.statusCode);
    try { console.log(JSON.parse(res.body)); }
    catch { console.log(res.body); }
  } catch (e) {
    console.error("Chyba:", e.message);
  }
})();
