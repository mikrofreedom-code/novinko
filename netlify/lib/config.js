// Centrálna konfigurácia – jedno miesto pravdy pre celý backend.

// ── SUPABASE: JEDEN PROJEKT, DVE HISTORICKÉ MENÁ ──
// Do 28. 8. 2026 to boli dva rôzne projekty: SUPABASE_* patrilo staršiemu
// (držal len bucket s obrázkami) a REDAKCIA_SUPABASE_* projektu redakcie
// (fronta). Starý projekt bol zrušený a bucket presunutý do redakcie, takže
// obe dvojice dnes ukazujú na to isté miesto.
//
// PREČO PREPAD JEDNA NA DRUHÚ: kým sa čítali oddelene, dalo sa prepnúť jednu
// a druhá ticho mierila na neexistujúci projekt. Presne to zhodilo nahrávanie
// fotiek z publikovat.html — presun bucketu prepol premenné pipeline, ale
// SUPABASE_* na Netlify ostali na zrušenom projekte a `uploadUserImage`
// hlásil „nahratie fotky zlyhalo". Takto stačí mať nastavenú ktorúkoľvek
// dvojicu a funguje aj úložisko, aj fronta.
//
// Hodnoty ZÁMERNE nie sú v kóde — Netlify skener tajomstiev by zhodu
// s hodnotou premennej vyhodnotil ako únik a zhodil build.
// Každá dvojica uprednostní svoje pôvodné meno a až potom siahne po druhom.
// Sémantika sa teda nemení — keby niekto projekty zase rozdelil, úložisko aj
// fronta idú tam, kam doteraz. Prepad rieši len prípad, keď jedno meno chýba.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REDAKCIA_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.REDAKCIA_SUPABASE_SERVICE_KEY;
const REDAKCIA_URL = process.env.REDAKCIA_SUPABASE_URL || process.env.SUPABASE_URL;
const REDAKCIA_KEY = process.env.REDAKCIA_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Keby niekto v budúcnosti projekty zase rozdelil, nech to nie je ticho.
if (process.env.SUPABASE_URL && process.env.REDAKCIA_SUPABASE_URL
    && process.env.SUPABASE_URL !== process.env.REDAKCIA_SUPABASE_URL) {
  console.warn("[config] SUPABASE_URL a REDAKCIA_SUPABASE_URL ukazujú na RÔZNE projekty. "
    + "Úložisko obrázkov a fronta sa rozídu — ak to nie je zámer, zjednoť ich.");
}

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
  SUPABASE_URL,
  SUPABASE_KEY,
  REDAKCIA_URL,
  REDAKCIA_KEY,
  SHEET_CSV_URL,
  CATS,
  STORE_NAME,
  PARAGRAPH_DELIM,
  MAX_ITEMS,
  MAX_AGE_HOURS,
  MIN_SECTION_ITEMS,
};
