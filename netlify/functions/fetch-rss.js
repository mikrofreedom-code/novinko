// Frontendový endpoint. Primárne servíruje HOTOVÉ spravodajstvo z Netlify Blobs
// (pripravuje ho cron každých 10 min) => načítanie je takmer okamžité.
// Ak blob ešte neexistuje (prvý beh) alebo Blobs nie sú dostupné, poskladá to naživo.
const { loadNews, connect } = require("../lib/store");
const { buildPayload } = require("../lib/build");

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async (event) => {
  connect(event);
  const category = (event.queryStringParameters && event.queryStringParameters.category) || "all";

  // 1) rýchla cesta – pripravená cache
  const cached = await loadNews(category);
  if (cached && Array.isArray(cached.items) && cached.items.length) {
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "X-Source": "blob",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
      body: JSON.stringify(cached),
    };
  }

  // 2) núdzová cesta – poskladaj naživo (pomalšie, ale web funguje)
  try {
    const data = await buildPayload(category);
    return {
      statusCode: 200,
      headers: { ...CORS, "X-Source": "live", "Cache-Control": "public, max-age=60, s-maxage=120" },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ items: [], count: 0, error: e.message }),
    };
  }
};
