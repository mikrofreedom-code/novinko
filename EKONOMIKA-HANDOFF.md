# Ekonomika — stav úpravy 21. 10. 2026

Používateľ požiadal o profesionálnu a nadčasovú ekonomickú rubriku.
Úprava používa existujúce spravodajské dáta; nemení produkciu článkov,
Google Sheets ani schvaľovanie. Nepridáva platené AI volania ani predplatné.
Produkčný deploy podľa projektového rozpočtu stojí 15 Netlify kreditov.

## Výsledok

- Úvod „Ekonomika, ktorá sa dotýka vás“, výrazná typografia, zelený akcent.
- Pohľady **Správy** a **Trhy a kalendár**.
- Hlavný článok a tri ďalšie, následne chronologický zoznam.
- Filtre Slovensko, Európa, Ceny a inflácia, Sadzby a úvery, Firmy a obchod,
  Energie, Práca a mzdy. Používajú titulok a perex s normalizáciou diakritiky;
  nejde o ručne pridelené štítky ani vyhľadávanie v celom archíve.
- V bočnom paneli základné vysvetlenia inflácie, úrokov a HDP a odkazy na redakciu.
- Existujúci cenový pás sa načíta až pri návšteve Ekonomiky.
- Graf EUR/USD a existujúci kalendár sa načítajú až pri otvorení Trhov.
- Indexové symboly FOREXCOM/CAPITALCOM zostávajú zachované; ich názvy v páse
  teraz výslovne uvádzajú CFD. Nezamieňať ich za hotovostné indexy, ktorých
  voľné kotácie v tomto widgete predtým nefungovali.
- Informácia o poskytovateľovi, možnom oneskorení a anglických názvoch kalendára.
- Kalendár má výslovne `locale: en` (slovenské rozhranie tohto widgetu sa
  nepoužíva). Pri dlhom čakaní na externý skript sa po 12 sekundách zobrazí
  hláška s odkazom; po úspešnom načítaní zmizne.
- Svetlý/tmavý režim stránky, mobilné rozloženie, ovládanie odkazmi a história.
- Zachovaná jedna pôvodná reklama, ktorá sa presúva medzi aktívnymi pohľadmi.

## Kód

| Súbor | Úloha |
|---|---|
| `assets/economy.js` | Render, filtre, stav URL, presun kalendára a reklamy. |
| `assets/economy.css` | Ekonomický akcent, úvod, slovníček a veľkosť kalendára. |
| `assets/crypto.css` | Zdieľané redakčné karty, zoznamy, responzívne a tmavé štýly oboch rubrík. |
| `assets/market-widgets.js` | Spoločný odložený loader TradingView, ochrana pred opakovaným vložením a hláška pri chybe skriptu. |
| `assets/crypto.js` | Krypto teraz používa spoločný loader; jeho správanie sa má zachovať. |
| `index.html` | Zapojenie súborov, samostatná vetva Ekonomiky, deaktivácia portálov a čistenie parametrov pri zmene rubriky. |
| `test/economy.test.cjs` | URL stav a filtre vrátane diakritiky a falošných zhôd. |
| `test/market-widgets.test.cjs` | Jednorazové vloženie, pomalé načítanie, zotavenie a chyba widgetu. |

Adresy: `/?rubrika=ekonomika`, `/?rubrika=ekonomika&pohlad=trhy`,
napríklad `/?rubrika=ekonomika&tema=inflacia`.
Pri prepínaní rubrík deaktivovať predchádzajúci portál pred renderom ďalšieho,
aby sa reklama vrátila do pôvodného kontajnera. Zachovať aj vetvu Krypto.

## Overenie a limity

Dodatočná kontrola 21. 10. opravila navigáciu po filtrovaní a odkaze na trhy
zo spodku stránky: nové ovládanie sa posunie do obrazovky a zachová fokus.
Aktívny odkaz nevytvára duplicitný záznam histórie. Filter Práca a mzdy
už nezachytáva „platforma“, „platby“ či „platnosť“ a samotné slovo
„federálny“ nestačí na zaradenie medzi sadzby. Počty článkov sa skloňujú.
Na mobile má hlavný článok titulok pred obrázkom, aby bol obsah skôr viditeľný.
Rozšírený browser test overuje aj polohu ovládania po kliknutí, fokus a históriu.

Unit testy Ekonomiky a Krypta, syntax JS, build a `git diff --check`.
Lokálny Chrome s testovacími článkami: počítač, 390/320 px, filtre, lazy widgety,
Späť, priama URL Trhov, tmavý režim, prepínanie Krypto/Ekonomika/Úvod, reklama,
prázdny feed a zlyhanie načítania. Dočasný test:
`/tmp/novinko-economy-browser-test.cjs`.
Skutočné widgety kontroluje `/tmp/novinko-economy-live-test.cjs`;
dočasné screenshoty sú `/tmp/novinko-economy-*-live.png`.
Živá kontrola potvrdila HTTP 200 oboch skriptov a iframe, viditeľný graf
EUR/USD aj konkrétne riadky kalendára (vrátane žiadostí o podporu,
spotrebiteľskej dôvery, PMI a sadzby Fedu). Kalendár so slovenským nastavením
v prvom pokuse zostal na spinneri; posledná overená konfigurácia používa
angličtinu a po čakaní zobrazila udalosti. Nevyvodzovať z jediného testu,
že každé budúce pomalé načítanie spôsobuje jazykové nastavenie.
Po vyčlenení loadera prešiel znovu aj pôvodný browser test Krypta.

Pri prázdnom widgete prever skutočný obsah skriptu, CSP, rozmery iframe,
posunutie widgetu do obrazovky a následne vykreslené údaje. Samotný HTTP 200
nepotvrdzuje zobrazenie dát. Hláška loadera zachytáva chybu externého skriptu,
nie všetky možné chyby vnútri cudzieho iframe.

Samostatná serverovo vykreslená URL rubriky ani nové redakčné metadáta
v Sheets nie sú súčasťou tejto úpravy. Commity, push a produkčné nasadenie
treba overiť zvlášť; používateľ si push robí sám.
