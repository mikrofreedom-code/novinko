// Robustný CSV parser (zvláda úvodzovky aj zdvojené "" vnútri poľa).

// Rozparsuje jeden riadok na stĺpce.
function parseCSVLine(line) {
  const cols = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }  // zdvojená úvodzovka = literál
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols.map((c) => c.trim());
}

// Celé CSV -> pole objektov podľa hlavičky.
function parseCSV(csv) {
  const lines = csv.trim().split("\n").filter((l) => l.trim());
  if (lines.length <= 1) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] || ""));
    return obj;
  });
}

module.exports = { parseCSV, parseCSVLine };
