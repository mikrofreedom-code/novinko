const https = require("https");
const http = require("http");

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsAggregator/1.0)" }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function extractOgImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].startsWith("http")) return match[1];
  }
  return null;
}

exports.handler = async (event) => {
  const { url } = event.queryStringParameters || {};
  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing url" }) };
  }

  try {
    const html = await fetchUrl(decodeURIComponent(url));
    const image = extractOgImage(html);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
      body: JSON.stringify({ image }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ image: null }),
    };
  }
};
