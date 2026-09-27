// Nový riadok v úvodzovkách patrí do bunky, nie medzi články.
(function (root) {
  function splitCSVRecords(csv) {
    const records = [];
    let start = 0, quoted = false;
    for (let i = 0; i < csv.length; i++) {
      if (csv[i] === '"') {
        if (quoted && csv[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && (csv[i] === '\n' || csv[i] === '\r')) {
        const record = csv.slice(start, i);
        if (record.trim()) records.push(record);
        if (csv[i] === '\r' && csv[i + 1] === '\n') i++;
        start = i + 1;
      }
    }
    const last = csv.slice(start);
    if (last.trim()) records.push(last);
    return records;
  }
  if (typeof module === 'object' && module.exports) module.exports = { splitCSVRecords };
  else root.splitCSVRecords = splitCSVRecords;
})(globalThis);
