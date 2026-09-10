// Cron (každých 5 min, netlify.toml): zapíše do hárku naplánované články
// z publikovat.html, ktorých čas už prišiel. Riadok je hotový už od odoslania
// formulára (manual-publish.js) — tu sa len zapíše presne tak, ako by to
// urobilo okamžité publikovanie (appendRow + Telegram notifikácia).
//
// Prečo cez frontu v Blobs, nie priamym zápisom s budúcim dátumom: hárok je
// zdroj pravdy a nemá koncept "draftu" — 7 rôznych miest webu ho číta bez
// akéhokoľvek filtra na budúci dátum, takže čokoľvek by sa doň zapísalo
// s dátumom v budúcnosti, bolo by na webe okamžite. Viď komentár pri
// SCHEDULED_KEY v lib/store.js.
const { appendRow } = require("../lib/sheets");
const { sendArticle } = require("../lib/telegram");
const { loadScheduled, saveScheduled, connect } = require("../lib/store");

exports.handler = async (event) => {
  connect(event);

  const list = await loadScheduled();
  if (!list.length) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, published: 0, zostava: 0 }) };
  }

  const now = Date.now();
  const due = list.filter((x) => Date.parse(x.publishAt) <= now);
  const rest = list.filter((x) => Date.parse(x.publishAt) > now);

  let published = 0;
  const zlyhane = [];
  for (const item of due) {
    try {
      await appendRow(process.env.GOOGLE_SHEETS_ID, item.row, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      await sendArticle({
        title: item.headline,
        perex: item.perex,
        imageUrl: item.imageUrl,
        sheetId: item.row[0],
      });
      published += 1;
    } catch (e) {
      // Nezahadzuj — skús znova o 5 minút. Ponecháva sa vo fronte tak dlho,
      // kým sa zápis nepodarí (napr. dočasný výpadok Google Sheets API).
      zlyhane.push(item);
    }
  }

  // Ulož naspäť VŽDY (aj keď due.length===0 by sa dalo preskočiť, ale
  // jednoduchšie a bezpečnejšie je ukladať konzistentne za každého behu).
  await saveScheduled([...rest, ...zlyhane]);

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, published, zlyhalo: zlyhane.length, zostava: rest.length + zlyhane.length }),
  };
};
