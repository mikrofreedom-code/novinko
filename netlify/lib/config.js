// Centrálna konfigurácia – jedno miesto pravdy pre celý backend.
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZoj1iM9WKbX_S-0Zsu-3ZU3vZGro3UFcWyGuuBY4e8sR474C9X0xf33N1Cok0YSqoLDVPn_dCVFXW/pub?output=csv";
// Kategórie, ktoré frontend pozná. Poradie = poradie filtrov v hlavičke.
const CATS = ["all", "slovensko", "svet", "ekonomika", "sport", "krypto", "ai", "krypto-skola"];
// Názvy úložísk v Netlify Blobs
const STORE_NAME = "news";          // pripravené spravodajstvo pre frontend
const BREAKING_KEY = "breaking";    // mimoriadne správy
// Oddeľovač odsekov v Google Sheets (skutočné \n by rozbili CSV riadok).
const PARAGRAPH_DELIM = "¶¶";
// Koľko článkov maximálne vrátiť na jednu kategóriu
const MAX_ITEMS = 100;
// Vlastné články staršie ako toľko hodín sa NEZOBRAZUJÚ na hlavnej (idú do archívu).
const MAX_AGE_HOURS = 24;
module.exports = {
  SHEET_CSV_URL,
  CATS,
  STORE_NAME,
  BREAKING_KEY,
  PARAGRAPH_DELIM,
  MAX_ITEMS,
  MAX_AGE_HOURS,
};
