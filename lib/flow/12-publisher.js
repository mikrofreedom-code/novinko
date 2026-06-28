// ============================================================
// 12. Publisher
// ------------------------------------------------------------
// ROLA:          Publikuje do DB/frontendu. Ak MANUAL_APPROVAL=true, čaká na tvoje schválenie.
// VSTUP status:  imaged
// VÝSTUP status: published
// STAV:          🟢 máš
// AI vrstva:     —
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 12,
  name: "Publisher",
  input: "imaged",
  output: "published",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
