const { runGenerator } = require("../lib/generator");
const { denyIfUnauthorized } = require("../lib/guard");
const { GEN_FEEDS } = require("../lib/feeds");

exports.handler = async (event) => {
  const deny = denyIfUnauthorized(event);
  if (deny) return deny;
  const result = await runGenerator({ category: "svet", feeds: GEN_FEEDS.svet, perFeed: 1, event });
  const statusCode = result.error ? 500 : 200;
  return { statusCode, body: JSON.stringify({ success: !result.error, ...result }) };
};
