const { runGenerator } = require("../lib/generator");
const { denyIfUnauthorized } = require("../lib/guard");
const { GEN_FEEDS } = require("../lib/feeds");

exports.handler = async (event) => {
  // ZÁMERNE bez { scheduled: true }: schedule je v netlify.toml zakomentovaný
  // (od 2026-07-05 krypto produkuje redakcia), takže toto je verejne dostupný
  // endpoint a edge ho nechráni. Pustí ho len správny CRON_SECRET.
  // Keď sa schedule niekedy vráti, pridaj sem { scheduled: true }.
  const deny = denyIfUnauthorized(event);
  if (deny) return deny;
  const result = await runGenerator({ category: "krypto", feeds: GEN_FEEDS.krypto, perFeed: 1, event });
  const statusCode = result.error ? 500 : 200;
  return { statusCode, body: JSON.stringify({ success: !result.error, ...result }) };
};
