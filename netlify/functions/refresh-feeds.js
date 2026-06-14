// Cron (každých 10 min): stiahne RSS + vlastné články a uloží HOTOVÉ
// spravodajstvo do Netlify Blobs. Vďaka tomu fetch-rss nič nesťahuje naživo.
const { buildAll } = require("../lib/build");
const { saveNews } = require("../lib/store");
const { CATS } = require("../lib/config");

exports.handler = async () => {
  try {
    const all = await buildAll();
    let saved = 0;
    for (const cat of CATS) {
      if (all[cat]) {
        await saveNews(cat, all[cat]);
        saved += 1;
      }
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, saved, fetched: new Date().toISOString() }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
