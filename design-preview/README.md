# Záhady a fenomény — návrh dizajnu

Pripravené 26. 9. 2026. Lokálna implementácia, zatiaľ bez nasadenia.

## Vizuálny smer

Magazín na krémovom papieri (#f7f5ef), lesná zelená (#253d33), mosadz (#8a6a38).
Písma nadväzujú na Novinko: Libre Baskerville a Source Sans 3. Jemné deliace
čiary, výrazná fotografia/ilustrácia, čitateľné nadpisy a priestor medzi blokmi.

Hlavná stránka: titulok rubriky, navigácia tém, hlavný príbeh a série,
vyhľadávanie a filtrovaný prehľad článkov, Tajomné Slovensko, tematické rozcestníky,
symbolika a horoskopy, vysvetlenie redakčného prístupu, pätička.
Hlavný príbeh uprednostní najnovší článok série Záhada týždňa, inak najnovší článok.
Bez článkov sa zobrazí úvod do rubriky a pravdivý prázdny stav.

Zdroj: `zahady.html`, `assets/zahady/sekcia.css`, `assets/zahady/sekcia.js`.
Detail článku: `assets/zahady/clanok.css`, téma v `netlify/lib/clanok-render.js`.
Nové zdroje v assets sa kopírujú existujúcim buildom. Náhľady z tohto priečinka
sa na verejný web nekopírujú. Žiadna nová závislosť ani databázová migrácia.

## Náhľady

- `desktop-uvod.png` — úvod pri šírke 1440 px.
- `desktop.png` — celá stránka pre počítač.
- `mobile.png` — celá stránka pri šírke 390 px.

Snímky zobrazujú stav rubriky bez publikovaných článkov. Funkcie boli navyše
skontrolované na 15 lokálnych testovacích položkách, ktoré nie sú súčasťou webu,
Google Sheetu ani Supabase.

## Overenie

Izolovaný produkčný build vrátane CSP. Chrome: šírky 1440, 390 a 320 px,
bez vodorovného pretekania dokumentu. Načítanie obrázkov, prázdna rubrika,
stránkovanie, kombinovanie filtrov, hľadanie bez diakritiky, história prehliadača,
výber bez výsledkov, chybový stav a úspešné opakovanie načítania.
Existujúce testy `node --test test/*.test.cjs` prešli.

## Ilustrácia

`assets/zahady/krajina.webp` (1536 × 1024, približne 128 kB).
Vytvorená vstavaným nástrojom imagegen; následne prevedená na WebP.
Fiktívna krajina a hrad, nie fotografia konkrétnej slovenskej pamiatky.
Označenie na stránke: „AI ilustrácia · imaginárna krajina“.
Existujúca ilustrácia horoskopu ostáva označená ako AI ilustrácia.

Finálny prompt:

> Create one wide landscape editorial illustration for a premium Slovak magazine about history, folklore and mysterious places, aspect ratio 3:2. Atmospheric aerial view of a fictional modest medieval stone ruin on a steep forested Carpathian hill on the RIGHT THIRD of frame, richly textured dense dark pine forest, layered wooded ridges disappearing into mist, pale soft dawn light behind the right ridge. The LEFT HALF consists of dark forest and low fog, visually quiet for white headline overlay. Deep muted evergreen, slate grey and warm desaturated limestone. Cinematic naturalistic matte photography aesthetic, refined quiet wonder, credible nature magazine aesthetic, not fantasy. No people, no UFOs, no paranormal entities, no magical glow, no text, no lettering, no watermarks. Fictional generic landscape, must not depict a named real castle. High detail. Save generated image as a local file for website integration.
