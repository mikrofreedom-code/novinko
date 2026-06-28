// ============================================================
// 06. Chief Editor
// ------------------------------------------------------------
// ROLA:          Mozog redakcie. Zoskupí fakty o tej istej udalosti naprieč zdrojmi a rozhodne čo stojí za článok.
// VSTUP status:  facts_ready
// VÝSTUP status: clustered
// STAV:          🔴 MVP
// AI vrstva:     1-2
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 06,
  name: "Chief Editor",
  input: "facts_ready",
  output: "clustered",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
