// ============================================================
// 13. Analytics
// ------------------------------------------------------------
// ROLA:          Číta výkon publikovaných článkov (čítanosť, čas, zdroje).
// VSTUP status:  published
// VÝSTUP status: —
// STAV:          ⚪ future
// AI vrstva:     —
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 13,
  name: "Analytics",
  input: "published",
  output: "—",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
