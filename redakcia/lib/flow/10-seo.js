// ============================================================
// 10. SEO
// ------------------------------------------------------------
// ROLA:          Meta tagy, slug, sitemap, kľúčové slová.
// VSTUP status:  legal_ok
// VÝSTUP status: seo_done
// STAV:          ⚪ future
// AI vrstva:     —
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

export const STAGE = {
  index: 10,
  name: "SEO",
  input: "legal_ok",
  output: "seo_done",
};

// TODO: implementácia podľa build poradia (pozri README).
export async function run(item) {
  // ... sem príde logika kroku ...
  return item;
}
