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

// ZÁCHRANA PRI SUROVOM RIADIACOM ZNAKU V REŤAZCI.
//
// Niektoré prompty (napr. 16-horoskop.js) explicitne pýtajú od modelu VIAC
// RIADKOV vnútri jedného JSON reťazca (napr. "body": "znamenie\natmosféra\n...").
// Model to má napísať ako escapované \n — ale namiesto toho občas vloží
// skutočný, surový znak nového riadku (alebo tabulátor/CR). Platný JSON string
// nesmie obsahovať surový riadiaci znak (U+0000–U+001F) neescapovaný — taký
// výstup zhodí JSON.parse s "Bad control character in string literal", a to
// repairStrayQuotes nerieši (tá sa stará len o znak ", nie o \n/\r/\t).
//
// Nájdené 8. 9. na horoskope: dávka [Strelec…Ryby] — presne tento prompt so
// striktne viacriadkovým "body" — padla na non-JSON dva dni po sebe aj po
// repairStrayQuotes. Namiesto plátania len na jednom mieste (16-horoskop.js)
// patrí oprava sem — parseModelJson zdieľa 05/06/07/08/13/15/16, takýto istý
// spôsob zlyhania môže nastať pri hocktorom viacriadkovom textovom poli.
//
// Rovnaký princíp ako repairStrayQuotes: sleduj, či sme vnútri reťazca (mimo
// nej sú riadiace znaky v JSON bežné a neškodné — formátovacie medzery medzi
// tokenmi), a VNÚTRI reťazca surový riadiaci znak escapuj namiesto zahodenia.
export function repairRawControlChars(s) {
  let out = '';
  let vRetazci = false;
  let escapovane = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escapovane) { out += ch; escapovane = false; continue; }
    if (ch === '\\') { out += ch; escapovane = true; continue; }
    if (ch === '"') { vRetazci = !vRetazci; out += ch; continue; }
    if (vRetazci && ch === '\n') { out += '\\n'; continue; }
    if (vRetazci && ch === '\r') { out += '\\r'; continue; }
    if (vRetazci && ch === '\t') { out += '\\t'; continue; }
    out += ch;
  }
  return out;
}

// Odpoveď modelu → objekt. Najprv poctivo, a až keď to zlyhá, postupne skús
// opravy — surové riadiace znaky aj zatúlané úvodzovky sa môžu vyskytnúť
// spolu, preto skúšame aj ich kombináciu. Vracia { ok, value } / { ok:false,
// chyba, cistyText } — volajúci si podľa `res.truncated` rozhodne, ako pád
// nahlási.
export function parseModelJson(text) {
  const cistyText = stripFences(text);
  const pokusy = [
    cistyText,
    repairRawControlChars(cistyText),
    repairStrayQuotes(cistyText),
    repairStrayQuotes(repairRawControlChars(cistyText)),
  ];
  let prvaChyba;
  for (let i = 0; i < pokusy.length; i++) {
    try {
      return { ok: true, value: JSON.parse(pokusy[i]), opravene: i > 0 };
    } catch (chyba) {
      if (i === 0) prvaChyba = chyba.message;
    }
  }
  return { ok: false, chyba: prvaChyba, cistyText };
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
