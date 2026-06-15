// Generovanie pôvodného SK článku cez Claude. Dôraz na vecnosť a žiadne vymýšľanie.
const { httpsPost } = require("./net");

const MODEL = "claude-sonnet-4-6";

function buildPrompt(item) {
  return `Si skúsený slovenský novinár pracujúci pre seriózny spravodajský portál. Na základe zdrojovej správy napíš PÔVODNÝ spravodajský článok v spisovnej slovenčine.

Zásady (dodrž ich striktne):
- Drž sa výlučne faktov zo zdroja. Nič si nevymýšľaj – nepridávaj čísla, mená, dátumy ani citáty, ktoré v zdroji nie sú. Ak údaj chýba, vynechaj ho.
- Píš neutrálne, vecne a bez bulváru. Žiadne hodnotenia ani špekulácie.
- Titulok originálny a výstižný, bez clickbaitu. Nie doslovný preklad.
- Perex: 2–3 vety, ktoré zhrnú podstatu.
- Telo: 3–4 odseky logicky usporiadané (čo sa stalo → kontext → dôsledky).
- Správna slovenská gramatika a diakritika. Anglické pojmy prelož prirodzene.
- Ak je to relevantné, stručne uveď súvislosť so Slovenskom alebo strednou Európou.

Vráť IBA platný JSON, bez markdownu a bez \`\`\`:
{"title":"slovenský titulok","perex":"2-3 vety","content":"odsek1\\n\\nodsek2\\n\\nodsek3"}

ZDROJ (${item.source}):
Titulok: ${item.title}
Popis: ${item.description}`;
}

function parseAIJson(text) {
  let t = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    const obj = JSON.parse(t);
    if (!obj || !obj.title) return null;
    return { title: String(obj.title).trim(), perex: String(obj.perex || "").trim(), content: String(obj.content || "").trim() };
  } catch {
    return null;
  }
}

async function generateArticle(item, apiKey) {
  const data = await httpsPost(
    "api.anthropic.com",
    "/v1/messages",
    {
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content: buildPrompt(item) }],
    },
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }
  );
  const text = data?.content?.[0]?.text || "";
  return parseAIJson(text);
}

module.exports = { generateArticle, MODEL };
