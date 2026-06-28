// ============================================================
// 04. Collector
// ------------------------------------------------------------
// ROLA:          Stiahne plný obsah položiek čo prešli bránou (celý text článku, metadáta). Stále bez AI.
// VSTUP status:  filtered
// VÝSTUP status: collected
// STAV:          🔴 stavať
// AI vrstva:     0 žiadna
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 04,
  name: "Collector",
  input: "filtered",
  output: "collected",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
