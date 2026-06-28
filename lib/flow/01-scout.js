// ============================================================
// 01. Scout
// ------------------------------------------------------------
// ROLA:          Iba objavuje udalosti. Nikdy nepíše, neoveruje, nepublikuje. Vloží surovú položku do queue.
// VSTUP status:  —
// VÝSTUP status: raw
// STAV:          🟡 prenos zo starého Novinka
// AI vrstva:     0 žiadna
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 01,
  name: "Scout",
  input: "—",
  output: "raw",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
