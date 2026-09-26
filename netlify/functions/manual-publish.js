// Ručné publikovanie článku cez formulár (publikovat.html) — bez terminálu,
// bez editovania Google Sheetu ručne (to je krehké, ľahko sa pokazí formát).
// Chránené jednoduchým zdieľaným heslom (MANUAL_PUBLISH_SECRET).

const { articleToRow } = require("../lib/article-row");
const { slugify } = require("../lib/clanok-render");
const { validateMystery, sameTopic, parseMeta, validArticleImageUrl } = require("../lib/zahady");
const { findMysteryTopic, findSheetArticle, updateSheetArticle, appendRow } = require("../lib/sheets");
const { syncMysteryTopic } = require("../lib/topics");
const { sendArticle } = require("../lib/telegram");
const { generateImage, uploadUserImage } = require("../lib/images");

// Netlify má strop na telo požiadavky ~6 MB a base64 nafúkne dáta o ~37 %.
// Kontroluje sa aj na strane formulára, ale tam sa to dá obísť — tu je to isté.
// Kategórie, do ktorých sa smie ručne publikovať. Podmnožina CATS z
// netlify/lib/config.js — 'all' a 'krypto-skola' sem nepatria ('all' je
// zbernica, krypto-skola má vlastný evergreen mechanizmus). 'zahrada' MÁ
// zmysel tu byť (na rozdiel od krypto-skoly) — BIBLIA-ZAHRADA.md kapitola 8:
// keď článok stojí na tom, že čitateľ niečo rozpozná (škodca, odroda), AI
// obrázok tam nepatrí a ide sa cez vlastnú fotku práve týmto formulárom.
// 'recepty' rovnako — vlastný recept s reálnou fotkou jedla.
const POVOLENE_KATEGORIE = ["krypto", "ai", "slovensko", "svet", "ekonomika", "sport", "zahrada", "recepty", "zahady"];

const MAX_FOTO_MB = 4;
const POVOLENE_TYPY = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const { safeEqual } = require("../lib/guard");
const {
  connect, recentFailures, recordFailure, clearFailures, RL_MAX_FAILURES,
  loadScheduled, saveScheduled,
} = require("../lib/store");

// Kým čas nepríde aspoň o toľko dopredu, publikuj hneď namiesto naplánovania —
// naplánovanie závisí od cronu s 5-minútovým krokom (netlify.toml), takže
// "o 30 sekúnd" by tak či tak čakalo na najbližší beh. Radšej okamžitá cesta,
// ktorá nezávisí od cronu vôbec.
const MIN_SCHEDULE_AHEAD_MS = 2 * 60 * 1000;

const SECRET = process.env.MANUAL_PUBLISH_SECRET;

// Verejný endpoint chránený jediným zdieľaným heslom => bez obmedzenia počtu
// pokusov sa dá hádať donekonečna a uhádnutie znamená zápis článkov na živý web.
function clientIp(event) {
  const h = event.headers || {};
  return h["x-nf-client-connection-ip"]
      || h["client-ip"]
      || String(h["x-forwarded-for"] || "").split(",")[0].trim()
      || "unknown";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "len POST" }) };
  }
  connect(event);

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "zlý formát požiadavky" }) }; }

  const ip = clientIp(event);
  if (await recentFailures(ip) >= RL_MAX_FAILURES) {
    return { statusCode: 429, body: JSON.stringify({ error: "priveľa neúspešných pokusov, skús o 15 minút" }) };
  }

  // Zlyháva zatvorene (bez nastaveného hesla neprejde nikto) a porovnáva
  // konštantne v čase (`safeEqual`), nie `!==`.
  if (!SECRET || !safeEqual(body.password, SECRET)) {
    await recordFailure(ip);
    return { statusCode: 401, body: JSON.stringify({ error: "nesprávne heslo" }) };
  }
  await clearFailures(ip);

  const articleId = String(body.articleId || '').trim();
  let original = null;
  if (articleId) {
    if (!/^\d{6,}$/.test(articleId)) return { statusCode: 400, body: JSON.stringify({ error: 'Neplatné ID článku.' }) };
    try { original = await findSheetArticle(process.env.GOOGLE_SHEETS_ID, process.env.GOOGLE_SERVICE_ACCOUNT_KEY, articleId); }
    catch (e) { return { statusCode: 503, body: JSON.stringify({ error: e.message }) }; }
    if (!original || original.row[6] !== 'zahady') return { statusCode: 404, body: JSON.stringify({ error: 'Článok rubriky sa nenašiel.' }) };
  }
  if (body.action === 'load') {
    if (!original) return { statusCode: 400, body: JSON.stringify({ error: 'Zadaj ID článku.' }) };
    const row = original.row;
    return { statusCode: 200, body: JSON.stringify({ ok: true, article: {
      articleId: row[0], headline: row[1], perex: row[2], text: String(row[3] || '').replace(/\s*¶¶\s*/g, '\n\n'),
      category: row[6], imageUrl: row[7], imageCredit: row[8], ...parseMeta(row[9]),
    } }) };
  }

  const { headline, perex, text, source, sourceUrl, category, imageUrl, generateAiImage, imagePrompt,
          imageBase64, imageType, imageCredit, publishAt } = body;
  if (!headline || !text) {
    return { statusCode: 400, body: JSON.stringify({ error: "chýba titulok alebo text článku" }) };
  }

  // Naplánovanie: formulár posiela už hotový ISO string (new Date(...).toISOString()
  // v prehliadači, viď publikovat.html) — tu len over, že je to platný dátum
  // dosť ďaleko v budúcnosti, inak sa to spracuje ako okamžité publikovanie.
  let scheduledIso = null;
  if (publishAt) {
    const t = Date.parse(publishAt);
    if (isNaN(t)) {
      return { statusCode: 400, body: JSON.stringify({ error: "neplatný dátum naplánovania" }) };
    }
    if (t > Date.now() + MIN_SCHEDULE_AHEAD_MS) scheduledIso = new Date(t).toISOString();
  }
  if (original && scheduledIso) return { statusCode: 400, body: JSON.stringify({ error: 'Aktualizáciu článku nemožno naplánovať; zverejni ju priamo.' }) };
  if (original && category !== 'zahady') return { statusCode: 400, body: JSON.stringify({ error: 'Aktualizovaný článok musí zostať v rubrike Záhady.' }) };

  let mystery = null;
  if (category === 'zahady') {
    try {
      mystery = validateMystery(body);
      if (original && !sameTopic(parseMeta(original.row[9]).canonicalTopic, mystery.canonicalTopic)) {
        throw new Error('Pri úprave zachovaj kanonickú tému; nový názov pridaj medzi alternatívne názvy.');
      }
      mystery.slug = original ? (parseMeta(original.row[9]).slug || slugify(original.row[1])) : slugify(headline);
      if (original) mystery.updatedAt = new Date().toISOString();
      if (!perex || !String(perex).trim()) throw new Error('Zadaj perex článku.');
      if (!imageBase64 && !imageUrl && !generateAiImage && !imagePrompt && !original?.row[7]) {
        throw new Error('Článok potrebuje titulný obrázok alebo ilustráciu.');
      }
      if (imageBase64 && mystery.imageKind === 'ai') throw new Error('Nahraná fotografia nemôže byť označená ako AI ilustrácia.');
      if ((generateAiImage || imagePrompt) && !imageBase64 && !imageUrl && mystery.imageKind !== 'ai') {
        throw new Error('Generovaný obrázok označ ako AI ilustráciu.');
      }
      if (mystery.imageKind !== 'ai' && !String(imageCredit || original?.row[8] || '').trim()) {
        throw new Error('Pri fotografii alebo ilustrácii uveď pôvod obrázka.');
      }
      const names = [mystery.canonicalTopic, ...mystery.aliases];
      const existing = await findMysteryTopic(process.env.GOOGLE_SHEETS_ID, process.env.GOOGLE_SERVICE_ACCOUNT_KEY, names, articleId);
      if (existing && mystery.newAngleReason.length < 30) {
        return { statusCode: 409, body: JSON.stringify({ error: `Téma už má článok: ${existing.title} (ID ${existing.id}). Aktualizuj ho, alebo pri skutočne novom uhle uveď dôvod aspoň 30 znakov.` }) };
      }
      const scheduled = await loadScheduled();
      const pending = scheduled.find((item) => {
        const meta = item.row?.[6] === 'zahady' ? parseMeta(item.row?.[9]) : {};
        return [meta.canonicalTopic, ...(meta.aliases || [])].some((name) => names.some((wanted) => sameTopic(name, wanted)));
      });
      if (pending && mystery.newAngleReason.length < 30) throw new Error('Téma už čaká na naplánované publikovanie.');
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: e.message }) };
    }
  } else if (original) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Aktualizácia je dostupná iba pre Záhady a fenomény.' }) };
  }

  const article = {
    headline: String(headline).trim(),
    perex: perex ? String(perex).trim() : "",
    body: String(text),
    // Whitelist namiesto pôvodného `category === "ai" ? "ai" : "krypto"`, ktoré
    // ticho prepísalo VŠETKO ostatné na krypto — pridanie položky do formulára
    // by samo nestačilo. Musí sedieť s CATS v netlify/lib/config.js, inak by
    // článok skončil v sekcii, ktorú web nepozná, a nikde by sa nezobrazil.
    category: POVOLENE_KATEGORIE.includes(category) ? category : "krypto",
    sources: mystery?.sources || [{ name: source ? String(source).trim() : "Novinko", url: sourceUrl ? String(sourceUrl).trim() : "" }],
    ...(mystery ? { mystery } : {}),
  };

  // Poradie: nahratá fotka → odkaz → AI ilustrácia.
  if (imageBase64) {
    if (!POVOLENE_TYPY.includes(imageType)) {
      return { statusCode: 400, body: JSON.stringify({ error: `nepodporovaný typ obrázka: ${imageType || "neznámy"}` }) };
    }
    const buffer = Buffer.from(String(imageBase64), "base64");
    if (!buffer.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "fotku sa nepodarilo prečítať" }) };
    }
    if (buffer.length > MAX_FOTO_MB * 1024 * 1024) {
      return { statusCode: 413, body: JSON.stringify({ error: `fotka má ${(buffer.length / 1024 / 1024).toFixed(1)} MB, maximum je ${MAX_FOTO_MB} MB` }) };
    }
    try {
      article.image_url = await uploadUserImage(buffer, imageType);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  } else if (imageUrl && String(imageUrl).trim().startsWith("http")) {
    // CSP webu povoľuje img-src len 'self', data: a https://*.supabase.co. Odkaz
    // inam by sa zverejnil, ale prehliadač by ho zablokoval a článok by vyšiel bez
    // obrázka — ticho. Radšej to odmietnuť hneď a povedať prečo.
    const u = String(imageUrl).trim();
    if (!validArticleImageUrl(u)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Použi obrázok zo Supabase, pripravený obrázok Novinka alebo pole na nahratie fotky." }),
      };
    }
    article.image_url = u;
  } else if (generateAiImage || (imagePrompt && imagePrompt.trim())) {
    article.image_url = await generateImage(article.headline, article.category, Date.now(), imagePrompt);
  } else if (original?.row[7]) {
    article.image_url = original.row[7];
  }

  // Zdroj obrázka sa uvádza len pri vlastnej fotke. Pri AI ilustrácii by bol
  // mätúci — tam pôvod hovorí popisok "vytvorené umelou inteligenciou".
  if (article.image_url && (imageCredit || original?.row[8])) {
    article.image_credit = String(imageCredit || original.row[8]).trim().slice(0, 200);
  }
  if (mystery && !article.image_url) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Titulný obrázok sa nepodarilo pripraviť.' }) };
  }

  try {
    const row = articleToRow(article, article.category, scheduledIso);

    if (original) {
      row[0] = original.row[0];
      row[5] = original.row[5];
      await updateSheetArticle(process.env.GOOGLE_SHEETS_ID, process.env.GOOGLE_SERVICE_ACCOUNT_KEY, original.rowNumber, row);
      let registry = null;
      try { registry = await syncMysteryTopic(row); }
      catch (e) { registry = { synced: false }; console.error('[manual-publish] evidencia aktualizovanej témy:', e.message); }
      return { statusCode: 200, body: JSON.stringify({ ok: true, updated: true, id: row[0], registry }) };
    }

    if (scheduledIso) {
      // NEZAPISUJ do hárku teraz — hárok je zdroj pravdy a číta ho 7 rôznych
      // miest webu bez akéhokoľvek filtra na budúci dátum (žiadne "draft").
      // Hotový riadok čaká v Blobs, publish-scheduled.js (cron */5 min) ho
      // zapíše, keď príde čas — viď komentár pri SCHEDULED_KEY v store.js.
      const list = await loadScheduled();
      list.push({
        row,
        publishAt: scheduledIso,
        headline: article.headline,
        perex: article.perex,
        imageUrl: article.image_url || "",
        queuedAt: new Date().toISOString(),
      });
      await saveScheduled(list);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, scheduled: true, publishAt: scheduledIso, id: row[0] }),
      };
    }

    await appendRow(process.env.GOOGLE_SHEETS_ID, row, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    let registry = null;
    if (mystery) {
      try { registry = await syncMysteryTopic(row); }
      catch (e) { registry = { synced: false }; console.error('[manual-publish] evidencia témy:', e.message); }
    }
    const tg = await sendArticle({ title: article.headline, perex: article.perex, imageUrl: article.image_url, sheetId: row[0] });
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, id: row[0], registry, telegram: tg.sent ? "poslané" : (tg.skipped || tg.error) }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
