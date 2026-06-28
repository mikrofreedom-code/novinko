// ============================================================
// 11. Image
// ------------------------------------------------------------
// ROLA:          Vygeneruje vlastný obrázok cez Flux Schnell. Vlastný = právna ochrana.
// VSTUP status:  seo_done
// VÝSTUP status: imaged
// STAV:          🟢 máš (Flux)
// AI vrstva:     —
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 11,
  name: "Image",
  input: "seo_done",
  output: "imaged",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
