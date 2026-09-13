// Cron (každých 10 min): stiahne RSS + vlastné články a uloží HOTOVÉ
// spravodajstvo do Netlify Blobs. Vďaka tomu fetch-rss nič nesťahuje naživo.
// Keď buildAll zlyhá, neuloží sa nič — web ďalej servíruje poslednú dobrú verziu.
const { buildAll } = require("../lib/build");
const { saveNews, connect } = require("../lib/store");
const { CATS } = require("../lib/config");

exports.handler = async (event) => {
  connect(event);
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
    console.error("[refresh-feeds] cache ponechaná bez zmeny:", e.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
