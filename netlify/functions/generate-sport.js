const { runGenerator } = require("../lib/generator");
const { GEN_FEEDS } = require("../lib/feeds");

exports.handler = async (event) => {
  const result = await runGenerator({ category: "sport", feeds: GEN_FEEDS.sport, perFeed: 1, event });
  const statusCode = result.error ? 500 : 200;
  return { statusCode, body: JSON.stringify({ success: !result.error, ...result }) };
};
