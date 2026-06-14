const { runGenerator } = require("../lib/generator");
const { GEN_FEEDS } = require("../lib/feeds");

exports.handler = async () => {
  const result = await runGenerator({ category: "krypto", feeds: GEN_FEEDS.krypto, perFeed: 1 });
  const statusCode = result.error ? 500 : 200;
  return { statusCode, body: JSON.stringify({ success: !result.error, ...result }) };
};
