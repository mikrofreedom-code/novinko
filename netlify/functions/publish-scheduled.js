// Cron (každých 5 min): zapíše do hárku naplánované články
// z publikovat.html, ktorých čas už prišiel. Riadok je hotový už od odoslania
// formulára (manual-publish.js) — tu sa len zapíše presne tak, ako by to
// urobilo okamžité publikovanie (appendRow + Telegram notifikácia).
//
// Prečo cez frontu v Blobs, nie priamym zápisom s budúcim dátumom: hárok je
// zdroj pravdy a nemá koncept "draftu" — 7 rôznych miest webu ho číta bez
// akéhokoľvek filtra na budúci dátum, takže čokoľvek by sa doň zapísalo
// s dátumom v budúcnosti, bolo by na webe okamžite. Viď komentár pri
// SCHEDULED_KEY v lib/store.js.
const { appendRow, sheetRowIds } = require("../lib/sheets");
const { sendArticle } = require("../lib/telegram");
const { loadScheduled, saveScheduled, connect } = require("../lib/store");

exports.handler = async (event) => {
  connect(event);

  const list = await loadScheduled();
  const now = Date.now();
  const due = list.filter((x) => Date.parse(x.publishAt) <= now);
  if (!due.length) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, published: 0, zostava: list.length }) };
  }

  // Riadok môže byť v hárku už z behu, ktorý spadol pred uložením fronty — druhý zápis by bol duplicita.
  const vHarku = await sheetRowIds(process.env.GOOGLE_SHEETS_ID, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

  const hotove = new Set();
  for (const item of due) {
    const id = item.row[0];
    try {
      if (!vHarku.has(id)) {
        await appendRow(process.env.GOOGLE_SHEETS_ID, item.row, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        await sendArticle({ title: item.headline, perex: item.perex, imageUrl: item.imageUrl, sheetId: id });
      }
      hotove.add(id);
    } catch (e) {
      // Ostáva vo fronte, skúsi sa znova o 5 minút.
      console.error(`[publish-scheduled] ${id}: ${e.message}`);
    }
  }

  // Znova načítať tesne pred zápisom — formulár mohol medzitým pridať ďalší článok.
  const aktualny = await loadScheduled();
  const zostava = aktualny.filter((x) => !hotove.has(x.row[0]));
  await saveScheduled(zostava);

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, published: hotove.size, zlyhalo: due.length - hotove.size, zostava: zostava.length }),
  };
};
