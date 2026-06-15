// RSS/Atom parser + textové utility. Žiadna sieťová logika tu nie je.

function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => safeChar(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => safeChar(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function safeChar(code) {
  try { return String.fromCodePoint(code); } catch { return ""; }
}

function stripHtml(s) {
  return String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "");
}

function safeDateISO(s) {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ─── Detekcia športu (oprava miešania športu do iných kategórií) ───
const SK_LETTERS = "a-z0-9áäčďéěíĺľňóôöŕřšťúůýž";
const SPORT_WORDS = [
  "futbal", "futbalov", "futbalist", "hokej", "hokejov", "hokejist",
  "tenis", "tenisov", "tenist", "basketbal", "volejbal", "hádzan",
  "cyklist", "cyklistik", "atletik", "atlét", "olympiád", "olympijsk",
  "šampionát", "brankár", "gól", "góly", "štadión", "biatlon",
  "lyžiar", "lyžovan", "slalom", "maratón", "nhl", "nba", "nfl", "mlb",
  "wimbledon", "paralympi", "súpisk", "polčas", "víťazn", "remíz",
];
const SPORT_PHRASES = [
  "ms vo futbale", "majstrovstvá sveta", "liga majstrov", "formula 1",
  "svetový pohár", "zlatá lopta", "play off", "play-off", "f-skupin",
];

function looksLikeSport(text) {
  const t = String(text || "").toLowerCase();
  if (SPORT_PHRASES.some((p) => t.includes(p))) return true;
  return SPORT_WORDS.some((w) => {
    const re = new RegExp(`(^|[^${SK_LETTERS}])${w}`, "i");
    return re.test(t);
  });
}

function pick(block, tag) {
  const cdata = block.match(new RegExp(`<${tag}\\b[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"));
  if (cdata) return cdata[1];
  const plain = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return plain ? plain[1] : "";
}

function parseRSS(xml, { source = "", category = "", limit = Infinity } = {}) {
  const items = [];
  let blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi);
  if (!blocks || blocks.length === 0) blocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];

  for (const block of blocks) {
    if (items.length >= limit) break;

    const title = decodeEntities(stripHtml(pick(block, "title"))).replace(/\s+/g, " ").trim();

    let link = pick(block, "link").trim();
    if (!link) {
      const m = block.match(/<link\b[^>]*href="([^"]+)"/i);
      link = m ? m[1].trim() : "";
    }
    link = decodeEntities(link).trim();

    const rawDesc = pick(block, "description") || pick(block, "summary") || pick(block, "content");
    const description = decodeEntities(stripHtml(rawDesc)).replace(/\s+/g, " ").slice(0, 220).trim();

    const pubDate = safeDateISO(pick(block, "pubDate") || pick(block, "published") || pick(block, "updated"));

    const imgM =
      block.match(/<media:content[^>]+url="([^"]+)"/i) ||
      block.match(/<enclosure[^>]+url="([^"]+)"/i) ||
      block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
    const image = imgM ? imgM[1] : "";

    if (!title || !link) continue;

    let cat = category;
    if (cat !== "sport" && cat !== "krypto" && looksLikeSport(title)) cat = "sport";

    items.push({ title, link, description, pubDate, image, source, category: cat });
  }
  return items;
}

module.exports = { parseRSS, decodeEntities, stripHtml, safeDateISO, looksLikeSport };
