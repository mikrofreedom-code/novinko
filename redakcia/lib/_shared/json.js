// JSON Z ODPOVEDE MODELU — jedno miesto pre všetkých agentov.
//
// PREČO EXISTUJE: pôvodne mal 05, 07 aj 08 vlastnú kópiu `stripFences`, ktorá
// strhla ``` len na ÚPLNOM začiatku a ÚPLNOM konci reťazca:
//
//   .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
//
// Keď model za uzatvárajúci ``` pridal čo i len jednu vetu ("Opravil som…"),
// koncový fence sa neodstránil, JSON.parse spadol a správa skončila v 'error'.
// Korektor (08) na tom medzi 2.–8.8.2026 stratil 15 UŽ NAPÍSANÝCH článkov —
// teda aj zaplatené volanie Sonnetu za každý z nich.
//
// Namiesto strihania okrajov teda JSON priamo VYREŽEME: buď z ```-bloku, alebo
// od prvej otváracej zátvorky po poslednú zatváraciu. Próza okolo je tým pádom
// neškodná, nech ju model pridá kdekoľvek.
//
// ČO ZÁMERNE NEROBÍ: neopravuje pokazený ani urezaný JSON. Keď je odpoveď
// useknutá na limite tokenov, parse musí spadnúť — volajúci to podľa
// `res.truncated` odlíši od skutočne pokazeného výstupu a nahlási správnu
// príčinu. Tichá „oprava" by tento rozdiel zahmlila.
// ZÁCHRANA PRI ZATÚLANEJ ÚVODZOVKE.
//
// Model otvorí slovenskú úvodzovku správne („), ale zavrie ju rovnou ("), a tá
// ukončí JSON reťazec uprostred vety. Namerané 9.8.2026 na reálnom článku:
//   … „Lokalita prešla dlhým schvaľovacím procesom…pripomienky."\n\nAby Amazon…
// Prompt to nerieši — PROOF_SYSTEM to zakazuje a model to robí aj tak, pri
// temperature 0 zakaždým rovnako (opakovanie s pripomienkou padlo na tom istom
// znaku). Musí to teda ustáť kód.
//
// PRAVIDLO: v platnom JSON za koncovou úvodzovkou reťazca nasleduje (po
// prípadných medzerách) vždy , : } ] alebo koniec vstupu. Keď tam je čokoľvek
// iné, tá úvodzovka reťazec nekončí — patrí do textu a treba ju escapovať.
//
// Nezasahuje do obsahu, len do zápisu znaku. Používa sa VÝHRADNE ako fallback
// po zlyhaní bežného JSON.parse, takže platnú odpoveď sa nemá ako dotknúť.
export function repairStrayQuotes(s) {
  let out = '';
  let vRetazci = false;
  let escapovane = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escapovane) { out += ch; escapovane = false; continue; }
    if (ch === '\\') { out += ch; escapovane = true; continue; }
    if (ch !== '"') { out += ch; continue; }
    if (!vRetazci) { vRetazci = true; out += ch; continue; }
    // Sme vnútri reťazca — je táto úvodzovka naozaj jeho koncom?
    const zvysok = s.slice(i + 1);
    if (/^\s*([,:}\]]|$)/.test(zvysok)) { vRetazci = false; out += ch; }
    else { out += '\\"'; }
  }
  return out;
}

// Odpoveď modelu → objekt. Najprv poctivo, a až keď to zlyhá, so záchranou.
// Vracia { ok, value } / { ok:false, chyba, cistyText } — volajúci si podľa
// `res.truncated` rozhodne, ako pád nahlási.
export function parseModelJson(text) {
  const cistyText = stripFences(text);
  try {
    return { ok: true, value: JSON.parse(cistyText), opravene: false };
  } catch (prva) {
    try {
      return { ok: true, value: JSON.parse(repairStrayQuotes(cistyText)), opravene: true };
    } catch {
      return { ok: false, chyba: prva.message, cistyText };
    }
  }
}

export function stripFences(s) {
  const text = String(s ?? '').trim();

  // 1) Uzavretý ```json … ``` blok → vezmi jeho vnútro, zvyšok odpovede ignoruj.
  //    Nezachytáva neuzavretý fence (urezaná odpoveď) — a to je správne, viď vyššie.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;

  // 2) Orež prózu okolo JSON-u. Objekt aj pole — 05 vracia objekt, ale nech to
  //    nezávisí od toho, čo ktorý prompt práve žiada.
  const start = body.search(/[{[]/);
  if (start === -1) return body.trim();
  const close = body[start] === '{' ? '}' : ']';
  const end = body.lastIndexOf(close);
  return end > start ? body.slice(start, end + 1) : body.slice(start).trim();
}
