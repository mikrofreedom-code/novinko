// ============================================================
// 02. Event Gateway
// ------------------------------------------------------------
// ROLA:          Filtre PRED AI: whitelist, blacklist, dedup (hash/URL), keywords, priorita. Tu padne 90-95% objemu. Bez AI.
// VSTUP status:  raw
// VÝSTUP status: filtered
// STAV:          🔴 stavať
// AI vrstva:     0 žiadna
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 02,
  name: "Event Gateway",
  input: "raw",
  output: "filtered",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
