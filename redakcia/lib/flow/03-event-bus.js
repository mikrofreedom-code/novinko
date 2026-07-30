// ============================================================
// 03. Event Bus
// ------------------------------------------------------------
// ROLA:          Infraštruktúra, nie agent. Status machine v Supabase. Cez tento "zbernicu" komunikujú všetci. Implementácia: _shared/queue.js
// VSTUP status:  *
// VÝSTUP status: *
// STAV:          🟢 core (queue.js)
// AI vrstva:     —
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 3,
  name: "Event Bus",
  input: "*",
  output: "*",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
