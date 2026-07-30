// ============================================================
// 08. Proofreader
// ------------------------------------------------------------
// ROLA:          Fact-check: overí že článok neobsahuje tvrdenie ktoré nie je vo faktoch. + gramatika. Lacná kontrola.
// VSTUP status:  written
// VÝSTUP status: proofed
// STAV:          🟡 ľahké
// AI vrstva:     2 Haiku
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 08,
  name: "Proofreader",
  input: "written",
  output: "proofed",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
