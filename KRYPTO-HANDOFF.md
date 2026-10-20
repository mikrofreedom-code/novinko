# Krypto — odovzdanie práce, 20. 10. 2026

## Dohodnutý smer

Používateľ chce kvalitný, moderný spravodajský web. Zvažovali sme rozhranie
podobné DEX stránkam, ale dohodnutý výsledok je redakčná rubrika s oddeleným
prehľadom trhu. Správy majú prednosť, grafy patria do pohľadu Trh.
Zmeny tejto etapy sa týkajú rubriky Krypto, nie kompletného prerobenia webu.

Nepridávať obchodovanie, nákup tokenov ani platené dátové služby bez zadania.
Existujúci svetlý/tmavý režim a vizuálna identita Novinka zostávajú základom.

## Stav v Gite a nasadenie

Pri kontrole 20. 10. 2026 sú v lokálnom Gite:

- `07c56e0` — Modernizovat rubriku Krypto: spravy, trh a skola.
- `d92c60f` — Opravit nacitanie prehladu kryptotrhu.
- Predchádzajúca súvisiaca práca: `231a3f0` — vkladanie a zobrazovanie
  odkazov v článkoch.

Súbory implementácie Krypto sú pri tejto kontrole čisté. Používateľ dostal
príkazy na commit a push a commity následne existujú lokálne. Stav vzdialenej
vetvy a úspešnosť posledného produkčného deploya tým nie sú potvrdené.
Pri probléme na produkcii najprv over nasadený commit.

Commit a push robí používateľ; bez výslovného zadania ich nespúšťaj.
V pracovnom strome sú aj iné rozpracované zmeny: nepoužívaj `git add .`,
neprepisuj ich a nevracaj ich späť.

## Čo je hotové

- Vlastný úvod „Krypto v súvislostiach“.
- Pohľady Správy, Trh a Krypto škola.
- Hlavný článok a tri ďalšie, potom chronologický zoznam.
- Filtre Všetko, Bitcoin, Ethereum, Altcoiny, ETF, Regulácia, Bezpečnosť, DeFi.
- Filtre používajú titulok a perex, normalizáciu diakritiky a regulárne výrazy.
  Nejde o ručne pridelené štítky ani AI klasifikáciu. Jeden článok môže
  zodpovedať viacerým filtrom; nejde o filtrovanie celého archívu.
- Vzdelávacie články z existujúcej kategórie `krypto-skola`.
- Bočný panel s odkazmi na školu, trh a informácie o redakcii.
- Veľký graf a prehľad trhu sa načítajú až pri otvorení Trhu.
  Cenový ticker sa načítava pri otvorení Krypto.
- Zachovaný reklamný blok; pri návrate na inú rubriku sa vracia na pôvodné miesto.
- Responzívny vzhľad, existujúci tmavý režim, ovládanie odkazmi a história prehliadača.
- Rozlíšenie prázdneho feedu a chyby jeho načítania.
- Chybová hláška pri zlyhaní načítania externého skriptu, s odkazom na TradingView.

Google Sheets, publikačná pipeline ani schéma údajov sa pri tejto úprave nemenili.
Nepribudli AI volania ani platené API. Nasadenie podľa projektového rozpočtu
spotrebuje 15 Netlify kreditov; lokálny build nie je produkčný deploy.

### Doplnenie: ručné pridávanie do Krypto školy

Na následnú otázku používateľa sme preverili pridávanie článkov. Formulár
`publikovat.html` nemal Krypto školu medzi kategóriami a `manual-publish.js`
ju nepovoľoval; bez povolenia by server kategóriu zmenil na bežné Krypto.
Doplnená možnosť **Krypto škola** v oboch miestach. Po nasadení používateľ
otvorí `/publikovat.html`, vyplní článok, vyberie Krypto školu a publikuje
alebo naplánuje článok rovnakým spôsobom ako ostatné ručné články.
Backend už túto kategóriu uchováva ako evergreen a `build.js` z nej skladá
samostatný feed. Nie je potrebný nový hárok ani ručné spustenie pôvodného
`redakcia/scripts/evergreen-populate.mjs` (ide o jednorazovú populáciu).
Overené mockovaným testom handlera v `test/zahady-publish.test.cjs`: správna
kategória sa zapíše do stĺpca G. Pri teste sa nič nezverejnilo na produkcii.
Táto dodatočná úprava potrebuje vlastný commit/push/deploy; nezamieňať ju
s už existujúcimi commitmi modernizácie a opravy TradingView vyššie.

## Kde začať v kóde

| Súbor | Úloha |
|---|---|
| `index.html` | Zapojenie CSS/JS, `showSection`, `updateContext`, `go`, `loadAll`, pôvodné kontajnery a konfigurácie TradingView. |
| `assets/crypto.js` | Vykresľovanie rubriky, filtre, URL stav, presun widgetov a reklamy, `mountWidgets`, chybové hlášky. |
| `assets/crypto.css` | Štýly rubriky, mobilné rozloženie a skrytie generického obsahu cez `.crypto-active`. |
| `assets/portal.css` | Spoločné farby, tmavý režim, hlavička a rozmery widgetov. |
| `test/crypto.test.cjs` | Normalizácia URL stavu a tematické filtre vrátane diakritiky a hraníc symbolov. |
| `scripts/build-site.sh` | Kopírovanie verejných súborov do `_site/`; nové assets sa kopírujú automaticky. |
| `scripts/gen-csp.mjs` | Generovanie CSP vrátane povolených domén TradingView. |

Adresy:

- `/?rubrika=krypto` — správy.
- `/?rubrika=krypto&pohlad=trh` — trh.
- `/?rubrika=krypto&pohlad=skola` — škola.
- `/?rubrika=krypto&tema=bitcoin` — príklad filtra.

`loadAll` musí po načítaní doplnkov aktualizovať aj Krypto, aby sa škola objavila
aj pri pomalšej odpovedi. `showSection('krypto')` má samostatnú vetvu;
generický render ostatných rubrík sa v nej nepoužíva.
Prepnutie pohľadu nesmie opakovane vytvárať tie isté iframe.

## Opravená chyba: prázdny Prehľad kryptotrhu

Používateľ po modernizácii nahlásil prázdny blok.
Skutočná príčina: nesprávna adresa externého skriptu.

- **Nesprávne:** `embed-widget-crypto-mkt-screener.js` — vrátil XML `AccessDenied`.
- **Správne:** `https://s3.tradingview.com/external-embedding/embed-widget-screener.js`.
- Konfigurácia naďalej používa `screener_type: "crypto_mkt"`.
- Výsledný iframe má cestu `/embed-widget/crypto-mkt-screener/`.
  Názov cesty iframe sa nesmie zamieňať s názvom JavaScript súboru.

Overené podľa oficiálnej dokumentácie:
https://www.tradingview.com/widget-docs/widgets/screeners/crypto-mkt-screener/

V Chrome s reálnou sieťou vrátil skript aj iframe HTTP 200.
Vizuálne potvrdená tabuľka Bitcoin, Ethereum, Tether, BNB, XRP, Solana atď.
Prvý screenshot bez čakania po posunutí bol ešte prázdny; následný test
po posunutí widgetu do obrazovky a počkaní potvrdil údaje. Pri kontrole
nepovažuj samotnú existenciu iframe alebo HTTP 200 za dôkaz vykreslenia dát.

Pôvodný test modernizácie mal externé požiadavky blokované. Overoval navigáciu
a odložené vytvorenie skriptov, nie funkčnosť poskytovateľa; preto túto chybu
nezachytil. Pri ďalších úpravách widgetov treba aj reálny sieťový test.

Chybová hláška zatiaľ zachytáva `error` externého skriptu. Nevie potvrdiť
načítanie údajov vo vnútri cudzieho iframe.

## Overenie a ďalšia diagnostika

Úspešne prešli:

```bash
node --test test/crypto.test.cjs test/article-links.test.cjs test/zahady.test.cjs test/csv-publication-date.test.cjs
node --check assets/crypto.js
bash scripts/build-site.sh
git diff --check
```

Chrome: počítač, mobil 390 px aj 320 px, filtre, škola, história Späť,
tmavý režim, návrat na úvod, priama URL Trhu, zachovanie reklamy,
prázdne/chybové dáta a neopakované vloženie widgetov.
Články pri lokálnom vizuálnom teste boli testovacie; trhové údaje pri kontrole
opravy pochádzali zo skutočného TradingView.

Dočasné pomôcky v tomto pracovnom prostredí (nemusia prežiť vyčistenie `/tmp`):

- `/tmp/novinko-crypto-browser-test.cjs` — lokálny Chrome test s testovacími článkami.
- `/tmp/novinko-screener-live-test.cjs` — kontrola skutočného TradingView.
- `/tmp/novinko-screener-live.png` — screenshot vykreslenej tabuľky.

Pri ďalšom prázdnom widgete:

1. Over nasadenie a zopakuj problém na priamej URL Trhu.
2. V Network over HTTP stav a obsah skriptu, nie iba jeho príponu `.js`.
3. Over konzolu a CSP: skript `s3.tradingview.com`, iframe
   `*.tradingview.com` / `*.tradingview-widget.com`.
4. Over rozmery viditeľného kontajnera a iframe, posuň ho do obrazovky a počkaj.
5. Otestuj priamy vstup, Správy → Trh → Škola → Trh a tlačidlo Späť.
6. Skontroluj skutočné riadky/ceny; nevkladaj vymyslené dáta ako náhradu.

## Čo ešte nie je implementované

- Samostatná serverovo vykresľovaná adresa `/krypto` a vlastné serverové SEO metadáta.
- Ručné tematické štítky v Sheets alebo presnejšia redakčná klasifikácia.
- Zmena šablóny článku na zhrnutie, tabuľky a grafy.
- Skutočné obchodné funkcie alebo DEX terminál.
- Automatické potvrdenie, že externý iframe už vykreslil živé údaje.

Sú to možné ďalšie úlohy, nie automaticky schválený rozsah práce.
