// ============================================================
// 09. Legal
// ------------------------------------------------------------
// ROLA:          Checklist (NIE AI zatiaľ): atribúcia je?, žiadne cudzie fotky?, citácie krátke?, žiadne investičné rady?
// VSTUP status:  proofed
// VÝSTUP status: legal_ok
// STAV:          🟡 rule-based
// AI vrstva:     0 žiadna
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 9,
  name: "Legal",
  input: "proofed",
  output: "legal_ok",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
