// Centrálna konfigurácia – jedno miesto pravdy pre celý backend.
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZoj1iM9WKbX_S-0Zsu-3ZU3vZGro3UFcWyGuuBY4e8sR474C9X0xf33N1Cok0YSqoLDVPn_dCVFXW/pub?output=csv";
// Kategórie, ktoré frontend pozná. Poradie = poradie filtrov v hlavičke.
const CATS = ["all", "slovensko", "svet", "ekonomika", "sport", "krypto", "ai", "krypto-skola"];
// Názvy úložísk v Netlify Blobs
const STORE_NAME = "news";          // pripravené spravodajstvo pre frontend
// Oddeľovač odsekov v Google Sheets (skutočné \n by rozbili CSV riadok).
const PARAGRAPH_DELIM = "¶¶";
// Koľko článkov maximálne vrátiť na jednu kategóriu
const MAX_ITEMS = 100;
// Vlastné články staršie ako toľko hodín už nie sú "čerstvé" — na hlavnej klesnú
// pod čerstvé a ostávajú len ako doplnenie do MIN_OWN_ITEMS. V archíve sú vždy všetky.
// (2026-08-10: zdvihnuté z 24 na 48 h. Nič sa nemaže, ide len o poradie na hlavnej —
// mazanie starých NESPRACOVANÝCH správ rieši fronta cez CLUSTERED_MAX_AGE_H.)
const MAX_AGE_HOURS = 48;
// Pod toľko položiek nesmie sekcia klesnúť. Keď ich čerstvé (vlastné + RSS)
// nenaplnia, doplnia sa staršími vlastnými článkami — až na koniec, nikdy nad
// čerstvé správy. Bez tejto poistky vysychá krypto a ai: sú to jediné kategórie
// bez zobraziteľných RSS feedov (krypto má 8, všetky anglické → gatherRss ich
// filtruje; ai nemá vo feeds.js ani jeden).
const MIN_SECTION_ITEMS = 6;
module.exports = {
  SHEET_CSV_URL,
  CATS,
  STORE_NAME,
  PARAGRAPH_DELIM,
  MAX_ITEMS,
  MAX_AGE_HOURS,
  MIN_SECTION_ITEMS,
};
