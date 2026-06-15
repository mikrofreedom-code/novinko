# Novinko v2 — čo sa zmenilo a ako nasadiť

Tento balík je kompletný refaktor backendu + opravy frontendu. Rieši dva hlavné problémy
(duplicitné články a pomalé načítanie) a sprehľadňuje celý kód.

---

## 1. Najdôležitejšie zmeny

### Rýchlosť načítania
- **Predtým:** každý návštevník spustil živé sťahovanie ~34 RSS feedov naraz. Stránka
  bola pomalá ako najpomalší (alebo mŕtvy) feed — pri timeoute 8 s to bolo bežne 8+ s.
- **Teraz:** nový cron `refresh-feeds` (každých 10 min) stiahne feedy raz, poskladá hotové
  spravodajstvo a uloží ho do **Netlify Blobs**. Frontend cez `fetch-rss` číta už hotové
  dáta → načítanie je takmer okamžité.
- In-memory cache (`let cache = {}`), ktorá v serverless nefunguje spoľahlivo, je preč.
- Mŕtvy Reuters feed odstránený, per-feed timeout znížený na 6 s.
- **Poistka:** ak by Blobs ešte neboli naplnené (prvý beh) alebo neboli dostupné,
  `fetch-rss` automaticky poskladá dáta naživo — web teda funguje vždy.

### Duplicitné články
- **Rozbitý dedup opravený:** v `generate-svet`/`generate-sport` boli DVE funkcie
  `titleExists` (druhá prepisovala prvú) a posielal sa im nesprávny argument. `generate-articles`
  nemal dedup vôbec.
- **Spoľahlivý dedup:** kontrola duplicít teraz beží cez **autentifikované Google Sheets API**
  (vždy čerstvé dáta), nie cez publikovaný CSV, ktorý sa aktualizuje s oneskorením a duplicity prepúšťal.
  Kontroluje sa zhoda podľa originálneho linku **aj** podľa titulku.
- **Kolízie ID odstránené:** ID článku je teraz založené na čase (`Date.now()` + počítadlo),
  takže ani pri súbehu cron jobov nevzniknú dva články s rovnakým ID. Crony sú navyše
  časovo rozložené (nešpustia sa naraz o polnoci).

### Kvalita článkov (pre čitateľa)
- Nový žurnalistický prompt: dôraz na vecnosť, **zákaz vymýšľania faktov**, neutrálny tón,
  čistá štruktúra (čo sa stalo → kontext → dôsledky), správna slovenčina.
- **Oprava zobrazenia odsekov:** článok sa predtým ukladal s odstránenými zlomami riadkov,
  takže sa zobrazoval ako jeden veľký blok. Teraz sa odseky korektne ukladajú (oddeľovač `¶¶`)
  a `clanok.html` ich správne rozdelí.

### Bezpečnosť
- XSS: všetok obsah z RSS sa na frontende escapuje (`esc`, `safeLink`) v `index.html` aj `clanok.html`.
- Pridané bezpečnostné a SEO/zdieľacie meta tagy (`description`, Open Graph), `Referrer-Policy`.

### Prehľadnosť kódu
- Štyri takmer identické generátory (~95 % rovnaký kód) nahradené **jedným zdieľaným jadrom**
  (`netlify/lib/`). Generátory sú teraz tenké 6-riadkové wrappery.
- Odstránený mŕtvy kód vo frontende (`featuredStoryHTML`, `secondaryStoriesHTML`).

---

## 2. Štruktúra súborov

```
index.html              ← opravený (escapovanie, meta tagy, čistý kód)
clanok.html             ← opravený (escapovanie, odseky, robustný CSV)
package.json            ← pridaná závislosť @netlify/blobs
netlify.toml            ← rozložené crony + nový refresh-feeds
test.js                 ← univerzálny lokálny test

netlify/lib/            ← NOVÉ: zdieľané knižnice
  config.js               konfigurácia (URL, kategórie, konštanty)
  net.js                  fetchUrl / httpsPost / httpsGet
  rss.js                  RSS/Atom parser
  csv.js                  robustný CSV parser
  feeds.js                zoznamy zdrojov (jedno miesto pravdy)
  sheets.js               Google Sheets: zápis + dedup + čítanie
  ai.js                   generovanie článku cez Claude
  build.js                skladanie spravodajstva
  store.js                Netlify Blobs (s poistkou)
  generator.js            jadro generátorov

netlify/functions/
  fetch-rss.js          ← prepísaný (číta hotovú cache)
  refresh-feeds.js      ← NOVÝ (cron, plní cache)
  generate-krypto.js    ← tenký wrapper
  generate-svet.js      ← tenký wrapper
  generate-sport.js     ← tenký wrapper
  breaking-scanner.js   ← prepísaný (ukladá výsledky do Blobs)
```

**Zmaž starý súbor:** `netlify/functions/generate-articles.js` (nahradený `generate-krypto.js`).

---

## 3. Nasadenie (krok po kroku)

V priečinku projektu (`~/Plocha/novinko`):

```bash
# 1) bezpečnostná poistka – ulož aktuálny stav do vetvy
git add -A && git commit -m "zaloha pred v2" || true
git branch zaloha-pred-v2

# 2) rozbaľ obsah balíka do projektu (prepíše staré súbory)
#    (ak si stiahol novinko-v2.zip do ~/Stiahnuté)
unzip -o ~/Stiahnuté/novinko-v2.zip -d ~/Plocha/novinko

# 3) zmaž starý nepotrebný súbor
rm -f netlify/functions/generate-articles.js

# 4) nainštaluj novú závislosť
npm install

# 5) lokálny test (poskladá spravodajstvo, vypíše počet zdrojov)
node test.js refresh-feeds
#    test generátora: node test.js generate-krypto

# 6) nasaď
git add -A
git commit -m "Novinko v2: rychlost (cache), spolahlivy dedup, opravy"
git push
```

### Premenné prostredia v Netlify
V Netlify → Site settings → Environment variables musia byť (rovnaké ako doteraz):
`ANTHROPIC_API_KEY`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`.
Netlify Blobs sa zapne automaticky, netreba nič nastavovať.

---

## 4. Voliteľný ďalší krok — banner mimoriadnych správ

`breaking-scanner` už ukladá mimoriadne správy do Blobs (kľúč `breaking`). Aby sa zobrazovali
ako červený banner, treba malý endpoint, ktorý ich vráti, a kúsok JS vo frontende. Keď budeš
chcieť, doplním to — je to ~20 riadkov.
