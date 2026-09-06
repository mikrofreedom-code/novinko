# CLAUDE.md — Novinko (koreň projektu)

> Orientačný dokument pre novú session. Načítava sa automaticky.
> Pipeline redakcie má vlastný, podrobnejší: **`redakcia/CLAUDE.md`** — prečítaj si ho,
> keď robíš čokoľvek v `redakcia/`.
>
> Píšem v slovenčine, kód a komentáre v angličtine alebo slovenčine podľa okolia.
> Buď priamy, žiadne generické povzbudzovanie — radšej čestný odborný pushback.

## Čo to je

**novinko.sk** — slovenský spravodajský web (krypto + AI). Beží naostro od 11. 8. 2026,
archív bol vtedy resetovaný na nulu. Prevádzkovateľ: Powerlink s. r. o., evidenčné
číslo **EV 176/26/SWP**.

Projekt má dve polovice, ktoré spolu komunikujú **iba cez Google Sheet**:

```
redakcia/          pipeline — zbiera, overuje, píše, koriguje články
      ↓ (zapíše riadok do hárku)
Google Sheet       JEDINÝ zdroj pravdy o obsahu webu
      ↓ (číta)
koreň repozitára   web — HTML stránky + netlify/functions/
```

**Hárok je zdroj pravdy.** Čo v ňom prepíšeš, to je o pár minút na webe. Nič sa
nekopíruje do databázy ani do statických súborov. Stĺpce `A:I` = id, title, perex,
content, source, date, category, imageUrl, imageCredit. Odseky sa oddeľujú `¶¶`,
skutočný nový riadok by rozbil CSV.

## Mapa

| kde | čo |
|---|---|
| `index.html` | hlavná stránka, celý render engine v inline JS |
| `clanok.html` | stránka článku skladaná v prehliadači — **má noindex** |
| `clanok.css` | štýly článku, zdieľa ich `clanok.html` aj serverová verzia |
| `netlify/functions/clanok.js` | indexovateľná stránka článku (`/clanok/<slug>-<id>`) |
| `netlify/functions/sitemap.js` | sitemap.xml generovaná pri požiadavke |
| `netlify/functions/fetch-rss.js` | dáta pre hlavnú, číta z Netlify Blobs |
| `netlify/functions/refresh-feeds.js` | cron každých 10 min, plní Blobs |
| `netlify/functions/manual-publish.js` | ručné publikovanie z `publikovat.html` |
| `netlify/functions/telegram-webhook.js` | klik na ✅/❌ v Telegrame |
| `netlify/lib/` | zdieľané knižnice webu |
| `scripts/build-site.sh` | poskladá `_site/`, zverejňuje sa LEN ten |
| `scripts/gen-csp.mjs` | CSP s hashmi inline skriptov, generuje sa pri builde |
| `redakcia/` | pipeline, vlastný CLAUDE.md, beží z lokálneho cronu |

## Tvrdé obmedzenia

**Rozpočet.** Web nemá príjem. AI ~$20/mes (jeho vlastný strop) + Netlify $9/mes.
Pri každom návrhu, ktorý pridáva AI volania alebo deploye, **povedz cenu sám od seba**.
Merať cez `redakcia/scripts/rozpocet.mjs`, nie odhadovať z cenníka.

**Netlify účtuje za DEPLOY, nie za build minúty.** Personal plán = 1 000 kreditov,
produkčný deploy stojí **15 kreditov** → ~66 deployov mesačne. Nikdy nenavrhuj nič,
čo spúšťa build často. Funkcie sú rádovo lacnejšie — čo sa dá vyriešiť za behu,
rieš funkciou.

**Nič sa nepublikuje automaticky.** `MANUAL_APPROVAL=true` — každý článok schvaľuje
človek klikom v Telegrame. Toto je zároveň to, čo drží výnimku v Článku 50 AI Act.

**Zverejnené ostáva.** Vypršať smú len NESPRACOVANÉ správy vo fronte. Hotový článok
nesmie z webu zmiznúť — po čase klesne pod čerstvé a ostáva v archíve.

## Čo beží

- **Doména:** novinko.sk, Let's Encrypt, DNS na Websupporte, `www` aj
  `novinko.netlify.app` presmerované na primárnu
- **Publikovanie:** Telegram so schvaľovaním + formulár `publikovat.html`
  (heslo `MANUAL_PUBLISH_SECRET`, nahrávanie fotky, zdroj obrázka)
- **Indexovanie:** Search Console overená (doména, cez DNS TXT).
  `sitemap.xml` číta Google od 18. 8., 128 stránok, stav Úspech.
  `news-sitemap.xml` odoslaná 19. 8. — Google ju hneď po odoslaní hlási ako
  „Nie je možné načítať", čo je jeho bežné správanie, kým ju prvý raz nestiahne.
- **Discover a Top stories:** `max-image-preview:large` + `NewsArticle` JSON-LD
  na stránke článku + news sitemap. Sú to len PREDPOKLADY spôsobilosti,
  nie záruka zaradenia.
- **Google Publisher Center:** publikácia **Novinko** vytvorená (19. 8.), logo
  nahraté. Názov musí presne sedieť s `news:name` v `news-sitemap.js`.
  Od marca 2025 už Publisher Center nie je bránou do Google News — zaradenie je
  automatické, toto slúži na správu značky.
- **AI transparentnosť:** tagline v hlavičke, popisky pod obrázkami, impressum §6
- **Pipeline:** hodinový cron na používateľovom desktope, NIE v cloude.
  Od 5. 9. 2026 s ROZVRHOM: nočná pauza 22:00–5:00 (celý beh, nielen scout) a
  kadencia per sekcia — svet každú hodinu, krypto každé 2, ekonomika každé 3,
  AI každé 4, s posunmi tak, aby žiadna aktívna hodina nebola prázdna a žiadna
  nemala všetky štyri naraz. 35 sťahovaní denne namiesto 68. Nastavuje sa
  v `lib/sections/index.js` (`scoutEveryH`, `scoutOffsetH`), pauza v
  `run-pipeline.mjs` (`NIGHT_PAUSE_FROM_H`/`TO_H`, `--force` ju obíde).
  POZOR: `PRUNE_HOUR` musí ležať mimo pauzy, inak sa údržba nespustí nikdy.
  14.–18. 8. bežalo 24 behov denne bez výpadku.
- **Náklady (merané 19. 8.):** AI $0.625/deň ≈ $19/mes + Replicate ~$1.35
  + Netlify $9 → **~$29/mesiac**. Denný strop bol 5. 9. zdvihnutý z $0.80 na
  **$1.20** (`DAILY_BUDGET_USD` v `.env`) kvôli štyrom sekciám.
  Namerané 5. 9.: extrakcia $0.0097/volanie, Writer $0.0225, korektúra $0.0084,
  obrázok $0.0004 → hotový článok ≈ **$0.032** plus extrakcie, ktoré k nemu viedli.

## Čo bolí

**Spiaci stroj.** Pipeline beží z lokálneho cronu. Keď desktop spí, redakcia stojí
a po 24 h aj stráca nazbierané správy. Nevyriešené od 9. 8. 2026 — buď vypnúť
uspávanie, alebo presunúť na VPS.

**CSP je prísna a ľahko sa o ňu zakopne.** Obrázky len z `*.supabase.co`, skripty
len z `self` + TradingView + hashe. Čokoľvek iné prehliadač **ticho** zablokuje.
`gen-csp.mjs` neprehľadáva podpriečinky — generované stránky nesmú mať inline skripty.

**Dve cesty k tomu istému.** `netlify/lib/` a `redakcia/lib/_shared/` majú vlastné
kópie `articleToRow` aj `paragraphsToCell`. Keď meníš jednu, **musíš aj druhú** —
inak sa ten istý článok uloží rôzne podľa toho, ktorou cestou prišiel.

**Zlúčenie clusteru strácalo polia položky** (nájdené a OPRAVENÉ 5. 9.).
`mergeClusterFacts()` v `06` prenášal len `facts[]`, `entity` a `event_type` —
`source_emphasis` sa zahadzoval, takže bonus +8 v `importance.js` v produkcii
nikdy nezafungoval (všetkých 18 klastrov ekonomiky malo null, hoci položky vo
`facts_ready` hodnotu niesli). Poučenie platí ďalej: **keď pridávaš pole do
`buildFacts()` v `05`, MUSÍŠ ho pridať aj do `mergeClusterFacts()` v `06`** —
inak zmizne pri klastrovaní a nikto si to nevšimne, lebo skóre stále nejaké vyjde.

**`KRYPTO_RE` má tichú dieru** (nájdené 5. 9., NEOPRAVENÉ). Celý výraz je obalený
`\b(...)\b`, ale `tokeniz` a `virtual currenc` sú kmene — po nich sa vyžaduje
hranica slova, takže „tokenization" ani „virtual currency" **nikdy nesadnú** a
tie témy cez `cryptoFilter` neprejdú. Neopravoval som to, lebo je to živá sekcia
a zmena filtra patrí do samostatného commitu s meraním, čo pribudne.
`EKONOMIKA_RE` tú chybu už nemá (len celé slová a explicitné varianty).

## Čo čaká (stav k 5. 9. 2026)

### ✅ VÝPADOK KREDITU VYRIEŠENÝ (5. 9.)

Od 24. 8. do 5. 9. redakcia nepísala — Anthropic účet nemal kredit a všetko, čo
dorazilo k `05-verification`, padalo na `credit balance is too low`. Kredit je
dobitý a overený živým volaním; extrakcia aj Writer zase bežia.

Čo z toho ostalo v kóde a platí ďalej:

- **`retry.js` má pre nedostatok kreditu vlastnú vetvu**, rovnako ako budget
  guard: nepočíta sa do `MAX_RETRIES` (odmietnutý pokus na nulový kredit nič
  nestojí), takže sa skúša znova pri každom behu, kým sa účet nedobije. Predtým
  sa chyba netrafila do `TRANSIENT` regexu a položka zostala v `error` navždy.
  Overené v prevádzke: jeden beh vrátil do hry 194 položiek.
- **`05-verification` má škrt veku.** Po dobití retry vrátil 428 položiek, z
  toho 360 starších než 24 h — Writer by ich aj tak zahodil, ale Haiku by sa za
  ne zaplatilo (~$2,4) a hlavne by vytlačili čerstvé správy z kandidátskeho
  fondu (`claim()` radí najstaršie prvé; v jednej dávke bolo 200 z 200
  zastaraných). Odteraz sa zamietnu bez AI volania.

### KRYPTO A AI HLADOVALI — nájdené a opravené (5. 9., ten istý deň ako vyššie)

Používateľ nahlásil: stránky krypto a AI takmer prázdne (6 článkov). Príčina
mala dve vrstvy, obe z toho istého dňa pridania Ekonomiky a Sveta:

1. **`05-verification` nemala fairness medzi sekciami.** Ekonomika (live:
   false) a Svet (live: false) súťažili o tých istých 12 extrakciách za
   hodinu ako krypto a AI — a `prescore.js` je naladený na krypto (SEC/ETF/
   hack…), takže krypto/AI prehrávali aj vecne. Za 24 h: krypto 4 collected/
   0 ďalej, ai 10 collected/0 ďalej, ekonomika+svet 270 položiek. OPRAVENÉ:
   neživé sekcie teraz nesúťažia o platenú extrakciu vôbec (`liveFor()` PRED
   vekovým škrtom, nie po ňom — inak by ich pauza trestala vekom).
2. **`MIN_SECTION_ITEMS` (web) bol 6.** Krypto a AI sú jediné kategórie bez
   zobraziteľných RSS feedov (krypto 8, všetky anglické, filtrujú sa preč; ai
   0), takže stoja len na vlastnej produkcii. Pri tenkej produkcii sa
   zobrazilo len 6 — hoci v hárku bolo cez 50 vlastných článkov. OPRAVENÉ:
   zdvihnuté na 30. Web zmena, potrebuje Netlify deploy (nie je automatický).

Oboje overené offline (simulované dávky, žiadne AI volanie/sieť).

**3. Dodatočné sprísnenie na výslovnú žiadosť používateľa** — bod 1 vyššie
(fairness medzi sekciami) nestačil. Zámer rozvrhu (viď "Rozvrh" nižšie) bol
VÝHRADNOSŤ, nie len spravodlivé delenie: „keď je krypto, len krypto články,
keď je AI, len AI — nech sa nepredbiehajú". `05-verification` teraz filtruje
platené položky aj cez `sectionDue(section, now)` — TÚ ISTÚ funkciu, akú už
`01-scout` používa na „čia je teraz hodina" — AND s `liveFor()`. Bežný
výsledok: presne jedna živá sekcia sa hýbe za hodinu. `roundRobinCap` (reuse
z `07-writer.js`) ostal len ako poistka pre výnimočný súbeh, keby sa neskôr
dve živé sekcie predsa stretli v tej istej hodine.

**Dôsledok, ktorý z toho vyplýva a je ZÁMERNÝ:** 4 z 17 aktívnych hodín
(7, 11, 15, 19) nemajú živú sekciu na rade vôbec — v tú hodinu je na rade
len Svet alebo Ekonomika (obe neživé), takže extrakcia v tú hodinu nerobí
nič platené. Prepočítané cez `sectionDue`+`liveFor` pre každú hodinu 5-21,
nie odhadom. Používateľ o tomto kompromise vie a prijal ho — nedopĺňať tie
hodiny krypto/AI ako „bonus", to by porušilo presne tú výhradnosť, o ktorú
išlo.

**Svet znížený z každej hodiny na každé 2 hodiny** (`scoutEveryH: 2,
scoutOffsetH: 1` — nepárne hodiny, dopĺňa krypto na párnych, nekryje sa).
Bolo to na požiadanie ("aj svet daj každé dve hodiny"), nemení počet tichých
hodín vyššie (tie určuje krypto/AI/Ekonomika, nie Svet) — len znižuje
zbytočné scoutovanie 10 zdrojov v hodinách, keď aj tak nikto neplatený
nepíše.

**STAV K 23:20 (5. 9.), OVERENÉ RÁNO 6. 9.:** beh o 5:00 aj 6:00 potvrdil
rozvrh naživo (`logs/pipeline.log`) — o 5:00 (nepárna hodina) scoutol AI aj
Svet, o 6:00 (párna) svet vypadol z `preskocene` presne podľa `scoutOffsetH`.
Krypto aj AI písali a publikovali normálne v oboch behoch.

**Ale pri tej istej kontrole sa našiel VEDĽAJŠÍ ÚČINOK opravy `357445b`**
(neplánovaný, nezapísaný vyššie): commit z 23:15 zaviedol `liveFor(sec) &&
sectionDue(sec, now)` ako podmienku pre `platene` v `05-verification`, čím
ale zároveň úplne zastavil AJ EXTRAKCIU pre neživé sekcie (Ekonomika, Svet) —
nielen písanie, ktoré blokoval `liveFor()` už predtým. Overené priamo v DB
(`mcp__supabase-redakcia`): 48 položiek `svet` prišlo do `collected` PO 23:15
a ani jedna nemá `facts` — a už by ani nikdy nemala, kým je `live: false`,
lebo `05-verification` sa k nim vôbec nedostane. Ekonomika: od 23:15 pribudlo
0 nových položiek do `collected` vôbec (RSS jednoducho nič nové nedoniesol).
**Dôsledok:** plán „6. 9. pozrieť väčšiu vzorku faktov" (pozri nižšie) bol by
bez zásahu nesplniteľný — fakty by sa už nehromadili, k dispozícii by bola
navždy len vzorka z 5. 9. spred opravy.

**OPRAVENÉ 6. 9. ráno** — `05-verification` dostal tretiu, malú vetvu popri
`vybrane` (živé due sekcie) a `zadarmo` (Layer A): `vzorka`. Berie NAJVIAC
`NONLIVE_SAMPLE_CAP` (default 2) položiek z neživých sekcií, ale LEN z toho,
čo v danom behu ostane nevyužité z `MAX_EXTRACTIONS_PER_RUN` po `vybrane` —
nikdy neuberá živej sekcii jej slot, len dopĺňa to, čo by inak prepadlo.
Poradie spracovania `[...zadarmo, ...vybrane, ...vzorka]` navyše zaručuje, že
keby budget guard zastavil AI náklady uprostred behu, príde na rad posledná.
Bez vekového škrtu (nezmyselné pre sekciu, ktorú Writer aj tak nepustí ďalej
bez ohľadu na vek). Overené OFFLINE (simulácia so skutočnými `liveFor`/
`sectionDue`/`roundRobinCap`/`prescore`, žiadne AI volanie/sieť): živá sekcia
s dostatočným backlogom dostane celý strop 12 a vzorka 0; live sekcia s len
3 kandidátmi dostane 3 a vzorka doplní zvyšných 2; keď nie je due žiadna živá
sekcia, vzorka je presne 2 (nie viac) a strieda Ekonomiku/Svet round-robin.
Cena: max. ~2 extrakcie × $0,0097 (Haiku) navyše len v hodinách, keď má due
živá sekcia menej než 12 čerstvých kandidátov — v praxi časté (5:00 beh mal
`ok: 2`, 6:00 beh `ok: 7`, oboje pod stropom), takže reálny náklad pôjde
smerom k stovkám dolárocentov mesačne, nie k novej položke rozpočtu.

**POZOR: táto oprava (6. 9.) ešte NIE JE commitnutá** — je len v pracovnom
strome, na rozdiel od vety nižšie, ktorá sa týka VÝHRADNE fixov z 5. 9.
Prvý beh, ktorý ju uvidí naživo, over rovnako ako vyššie: `ai_cost_log` podľa
`agent='05-verification'` a pole `vzorka` v `logs/pipeline.log`.

Všetko je commitnuté a POUSHNUTÉ (používateľ pushol sám z terminálu, 36
commitov na `origin/main`). Web zmena (`netlify/lib/config.js`) čaká na
Netlify deploy — to je iný krok než git push, používateľ o tom vie.

### Sekcia Ekonomika — ŽIVÁ od 6. 9.

`live: true` v `lib/sections/index.js` od rána 6. 9. Web bol pripravený vopred
— tab „Ekonomika", `CAT_LABELS` aj farba `--cat-eko` v `index.html` existujú
z ručného publikovania, takže zapnutie NEPOTREBOVALO deploy.

**Prvé reálne behy (6. 9., ručne spustené pri zapínaní):** 3 články prešli
cez Writera. 2 sa dostali až po `imaged` a odišla za ne žiadosť o schválenie
do Telegramu (skontroluj tam) — 1 dostal `09-legal` zamietnutie: „atribúcia:
fakty vyžadujú atribúciu, ale v texte nie je „podľa …"". To NIE JE porucha —
presne na toto brána existuje, zachytila to skôr, než sa dostalo k človeku.
Sleduj, či sa to opakuje často (bol by to signál na doladenie promptu), alebo
išlo o ojedinelý prípad.

- **Zdroje: 4** — Európska komisia, Fed, CNBC Economy, Euronews Business.
  Yahoo Finance a MarketWatch leteli von hneď v deň zavedenia (viď nižšie).
  Zamietnutí kandidáti sú aj s dôvodmi v komentári vo `feeds.js` — neskúšaj
  ich znova.
- **PRVÝ OSTRÝ BEH PREBEHOL 5. 9., sekcia je odskúšaná.** 18 položiek došlo do
  `clustered`, kde ich zastavil `live: false`. Kvalita sa delí PODĽA ZDROJA,
  nie podľa promptu:
  - CNBC 7 položiek / ~5 dobrých, Euronews 5 / 3 dobré
  - Yahoo 5 / **0**, MarketWatch 1 / **0** → oba vyhodené. Yahoo posielalo
    dennú tabuľku amerických hypotekárnych sadzieb (skóre 65, prešla by) a
    mikrokapitalizačné výsledky (Ligand, eGain, Asana).
  - Najlepší výstup (Euronews, ECB, skóre 90) je materiál na profesionálny
    článok: „inflácia 3,3 % v auguste" + „bola 2,9 % v júli" ako samostatný
    fakt ZO ZDROJA, očakávanie trhu ako `analysis`, prognóza ECB so `status:
    forecast`, doslovný citát. Presne o toto celý návrh šiel.
- **Čo NEFUNGUJE podľa plánu:** `market_reaction` (základ 30) sa nikdy
  nespustí — model klasifikuje trhové wrapy ako `data_release` (65). Kalibrácia
  toho typu je zatiaľ mŕtva litera. `announcement` (55) zase nevie oddeliť
  „Fed Warsh o inflácii" od „Trump na minci" — to je vec kvality zdroja, prah
  to nevyrieši.
- **ĎALŠÍ KROK (dohodnuté 5. 9.):** nechať bežať deň bez Yahoo šumu, 6. 9.
  pozrieť väčšiu vzorku faktov a podľa nej rozhodnúť o `live: true`. TENTO
  PLÁN BOL 6. 9. RÁNO OBJAVENÝ AKO MŔTVY — commit `357445b` (5. 9. 23:15)
  vedľajšou cestou zastavil pre neživé sekcie AJ extrakciu, nielen písanie
  (detail vyššie pri „STAV K 23:20"). Opravené tam istým commitom, čo pridal
  `vzorka` vetvu — odteraz znova pribúdajú fakty, len pomaly (max. 2/beh,
  striedavo s Ekonomikou).
- **Cez RSS ani cez stránku sa k slovenským dátam nedostaneš.** ŠÚSR, OECD, IMF
  aj US BLS vracajú 403/503 aj na HTML aj s naším čestným UA — blokujú automat
  na okraji siete. Obísť sa to dá len predstieraním inej identity a to je proti
  pravidlu v hlavičke `fetch-article.js` („žiadne obchádzanie blokov").
- **ALE OTVORENÉ API ŽIJÚ** (overené 5. 9.) — a to je cesta, nie scrapovanie:
  - `data.statistics.sk/api/v2/collection` (ŠÚSR, JSON-stat) → 200, zoznam
    datasetov aj s poľom `update`, takže sa dá zistiť, čo pribudlo.
  - Eurostat dissemination API → 200, hoci ich RSS je mŕtve. Vie vrátiť viac
    období naraz, čiže **predchádzajúca hodnota prichádza zo zdroja** a Writer
    ju nemusí dopočítavať (viď zákaz porovnaní v `05`).
  Nie je to riadok do `feeds.js` — je to nový typ zdroja: poller na zmenu
  `update`, mapovanie JSON-stat na fakty (Layer A, bez AI) a rozhodnutie, kedy
  je nové číslo správa. POZOR: dotaz na HICP vrátil december 2025 s `updated`
  6. 2. 2026 — čerstvosť preveriť skôr, než sa na tom začne stavať.
- **Čo bolo neoverené, teraz overené (6. 9.):** ako vyzerá HOTOVÝ ČLÁNOK.
  Writer s hospodárskou vetvou promptu bežal prvý raz, výsledok vyššie.

### Sekcia Svet — ŽIVÁ od 6. 9. večer (FIFO chyba opravená)

Rovnaký stav ako Ekonomika predtým: celá reťaz commitnutá, web tab „Svet"
existuje z ručného publikovania, takže zapnutie nepotrebuje deploy — ale na
rozdiel od Ekonomiky NEZAPÍNAM ju natrvalo, len jednorazovo otestovaná.

**JEDNORAZOVÝ TEST 6. 9. — VÝSLEDOK:** dočasne `live: true`, spustený
`run-pipeline.mjs` dvakrát. Oba behy napísali LEN Ekonomiku, Svet ani raz —
**objavená príčina**: `claim(50)` v `07-writer.js` je čisté FIFO podľa
`created_at`, bez ohľadu na sekciu. Ekonomika mala v ten moment ~45-50
`clustered` položiek starších než ktorýkoľvek svetový kus, takže celé okno 50
vyplnila sama a Svet sa do kandidátskej množiny (`cerstve`) vôbec nedostal —
`roundRobinCap` (ktorý má práve toto riešiť) nemá medzi čím striedať, keď
jedna sekcia obsadí celý claim skôr, než sa k nemu dostane. **Toto je NOVÝ,
inak umiestnený variant toho istého problému, čo mal fairness fix z 5. 9.
riešiť pre extrakciu — tu vznikol o krok ďalej, vo Writerovi.** Zapísané ako
TODO nižšie, netreba to riešiť pred ničím iným.

Aby sa dal vôbec vidieť reálny výstup, napísal som JEDEN konkrétny `clustered`
kus priamo cez `run(item)` (obídením dávky, mimo `run-pipeline.mjs`) — nie
niečo, čo by bežná prevádzka niekedy urobila sama, kým sa FIFO problém
nevyrieši:

- **Výstup:** Sánchez/Ceuta (Španielsko-Maroko, hraničný incident), zdroj
  Guardian World, `event_type: diplomacy`, `attribution_used: true`,
  134 slov, jasné „podľa Guardian World" pri sporných tvrdeniach. Kvalitatívne
  presne to, čo mal sourcing model (atribuovaná agregácia) dosiahnuť.
- **Nedostal sa do Telegramu** — pri postupe cez `08-proofreader` narazil na
  priebežný rozpočtový strop (`allowanceUsd()` v `cost.js`, rastie s hodinou
  dňa). Testovanie tento strop samo vyčerpalo (pozri nižšie). Položka zostala
  v stave `error`, `retry.js` ju vráti do hry, len čo strop dorastie (do pár
  hodín) — nepočíta sa jej to do `MAX_RETRIES`.
- **Cena tohto testu:** ručné behy dnes (dva plné `run-pipeline.mjs` + jeden
  priamy `run()`) minuli spolu ~$0,39 navyše k bežnej prevádzke, čím sa
  dnešný priebežný strop vyčerpal skôr, než by inak bol — automatické behy do
  cca 09:00-10:00 budú mať menej voľného rozpočtu než zvyčajne. Samoopravné,
  nič nerob.

**Rozhodnutie (ráno):** vrátené na `live: false` — draft ukázal, že
sourcing/prompt funguje, ale kým sa nevyrieši FIFO problém vo Writerovi,
Svet by za normálnej prevádzky rovnako nikdy nedostal svoj slot.

**VEČER 6. 9., na žiadosť používateľa ("odtiaľ mi neprichádza"):** FIFO
problém opravený — `07-writer.js` dostal `claimPerSection()`, ktorá claimuje
OSOBITNE za každú živú sekciu namiesto jedného globálneho FIFO `claim()`.
Hlbší backlog Ekonomiky tak už nemôže vytlačiť Svet z kandidátskej množiny.
Overené priamo v DB (len čítanie): Svet má 20+ pripravených kandidátov.
`live: true` natrvalo. Sleduj prvé ostré behy zblízka, rovnako ako pri
Ekonomike — Writer vetva pre Svet stále reálne bežala len raz (manuálne,
mimo dávky).

- **Zdroje: 10.** Primárne UN News a IAEA; redakcie BBC World, Guardian World,
  DW, France 24, Al Jazeera, NPR World, The Hindu International, Africanews.
  Bez keywordFilter — feedy si zúžil vydavateľ. Geografická rovnováha je
  zámer, nie náhoda (Blízky východ, Ázia, Afrika, USA popri Európe).
- **FRONTOVÁ LÍNIA SA TU NEROBÍ.** Vojnu (územia, straty, obete) píše redakcia
  ručne — rozhodnutie z 5. 9. po tom, čo overovanie zdrojov ukázalo neriešiteľný
  problém: ukrajinské oficiálne zdroje sú blokované (403/404), kým Kremeľ a TASS
  odpovedajú 200. Postaviť desk na dostupnom by systematicky prevážilo ruskú
  verziu. K tomu jazyk a otvorená sankčná otázka (EÚ zakázala šírenie viacerých
  ruských štátnych médií, Novinko je subjekt EÚ). Preto má `conflict` základ 25,
  teda pod latkou — prejde až pri súbehu piatich zdrojov. `diplomacy` (rokovania,
  sankcie, prímeria) ide normálne.
- **Nové pole `claimed_by`** — os fakt vs. tvrdenie. Zapína `attribution_required`,
  takže existujúca brána v `09-legal` zamietne text bez „podľa X". Overené;
  `09-legal` netreba meniť.
- **Nové pole `location`** — dateline.
- **Konfluencia NIE JE chrbtica skórovania**, hoci to tak bolo navrhnuté. Dáta:
  klastre s viac než jedným zdrojom sú 5-10 % (`clusterKey` vyžaduje presnú
  zhodu entity, a osem redakcií píše „US" aj „United States"). Základy preto
  stoja samy.
- **Čo zostáva neoverené:** úplne všetko za extrakciou. Writer so zahraničnou
  vetvou nebežal ani raz.

### Rubrika Záhrada — kroky 1-4 hotové (6. 9.), čaká na Netlify deploy

Kroky 1-2 z `BIBLIA-ZAHRADA.md` kapitoly 10 hotové: plán 84 tém
(`content/zahrada/plan.md`, vlastný parser `lib/_shared/zahrada-plan.js`) +
generátor `lib/flow/15-zahrada.js`, zapojený do `run-pipeline.mjs`.

**ŽIVÝ TEST UŽ PREBEHOL — sám, bez čakania na krok 3-4.** Zistené 6. 9. pri
kontrole DB: článok „Zalievanie záhrady: kedy a koľko vody skutočne treba"
prešiel celou reťazou 5. 9. a je `status: published` (schválené v Telegrame,
`approval_message_id: 694`). Legal profil (`ZAHRADA_CHECKS`) prešiel všetkých
8 kontrol, obrázok sa vygeneroval. Predchádzajúci zápis „živý test nikdy
neprebehol" bol zastaraný — nikto ho po schválení nezapísal späť sem.
Dôsledok: článok bol do dnešného rána na webe len cez „all"/archív (kategória
`zahrada` chýbala v `CATS`, takže sa nezobrazoval so správnym labelom a nemal
vlastný tab) — kroky 3-4 nižšie to dorovnávajú.

**Kroky 3-4 dokončené 6. 9.:**
- `netlify/lib/config.js` (`CATS`) a `netlify/functions/manual-publish.js`
  (`POVOLENE_KATEGORIE`) — `zahrada` pridané do oboch. Na rozdiel od
  `krypto-skola` ostáva zahrada aj v `POVOLENE_KATEGORIE` zámerne (BIBLIA
  kapitola 8: vlastná fotka cez `publikovat.html`, keď AI obrázok nepatrí).
- `netlify/lib/build.js` (`buildAll()`) — `zahrada` dostala rovnaký evergreen
  riadok ako `krypto-skola` (celý sheet, bez vekového orezania), zámerne MIMO
  `CAT_ORDER` (nezahlcuje homepage round-robin).
- **Vlastná stránka `zahrada.html`**, NIE integrovaná do `index.html`
  masthead-u — na výslovnú žiadosť používateľa: "chcem aby to bolo tak ako
  som ti poslal... ako nová webstránka, má vlastný dizajn". Svetlý masthead
  (na rozdiel od čierneho všade inde), podľa schváleného artefaktu "Sezóna v
  záhrade" (2026-09-05). `index.html` dostal len malú ochutnávku — blok
  „Sezóna v záhrade" (`ZAHRADA` konštanta, `--cat-zahrada`, `renderZahrada()`,
  vzor `.skola-section`, MIMO `SECTIONS`/`LEAD_SECTIONS`) s odkazom „Celá
  rubrika →" na `zahrada.html`. Žiadny nav-filter button pre zahradu v
  `index.html` hlavičke (na rozdiel od pôvodného zámeru v BIBLII kapitole 9)
  — tú úlohu prevzala vlastná stránka.
- **Čo `zahrada.html` NEMÁ**, hoci artefakt to ukazoval: štítky oblasť/typ
  (úžitková/okrasná/izbovky/trávnik, kedy/ako/prečo) v zozname článkov. Táto
  metadata sa NIKDY nedostane do hárku — stĺpce A:I nemajú pre ňu miesto a
  `articleToRow()`/`sheets.js` ju nečítajú. Pridať by znamenalo zmeniť schému
  hárku (dotklo by sa `netlify/lib/article-row.js` AJ
  `redakcia/lib/_shared/article-row.js` — presne tá „dvojitá cesta"
  z `CLAUDE.md`), čo je za hranicou dnešnej úlohy. Zapísané ako TODO nižšie.
- **Otvorená otázka od používateľa (6. 9.): zlúčiť Dom/Byt/Záhradu, alebo nie.**
  Rozhodnuté: najprv len Záhrada, štruktúra nech sa dá neskôr rozšíriť.
  Dom aj Byt zatiaľ NEEXISTUJÚ v žiadnej podobe — žiadny plán tém, žiadny
  `oblast` kód, žiadny generátor. Keby sa pridali, pôjde o porovnateľný objem
  práce ako Záhrada celá (nový ročný plán, nový `09-legal` profil — riziká
  domácnosti/bytu, napr. elektrina/plyn/stavebné zásahy, sú iné a nebezpečnejšie
  než záhradné), nie len premenovanie kategórie.
- **Deploy prebehol (6. 9., automaticky cez GitHub-Netlify prepojenie
  na push).** Overené naživo: `zahrada.html` vracia 200, kategória `zahrada`
  sa zobrazuje so správnym labelom, orphaned článok (Zalievanie) aj druhý
  publikovaný článok (Výška kosenia trávnika) sa zobrazujú správne.

### Záhrada — "web vo webe" dotiahnutý do konca (6. 9., popoludnie)

Pokračovanie tej istej žiadosti ("nová webstránka, vlastný dizajn") do
detailu, plus prvé ostré doladenia po pohľade na živú stránku s reálnymi
dátami:

- **Stránka článku (`netlify/functions/clanok.js` +
  `netlify/lib/clanok-render.js`) dostala rovnaký svetlý dizajn** ako
  `zahrada.html` — predtým klik na záhradný článok odviedol čitateľa späť
  do zdieľanej tmavej šablóny, ilúzia "webu vo webe" sa rozpadla na prvý
  klik. `theme: 'zahrada'` prepína font/farby cez CSS premenné, štruktúra
  aj SEO (JSON-LD, meta tagy) ostávajú identické pre všetky kategórie.
  Súvisiace odkazy pod záhradným článkom teraz filtrujú len na záhradu.
- **Grid bug opravený**: `.season-grid`/`.zahrada-grid` mali pevné 4 stĺpce,
  takže pri menej než 4 článkoch (bežný stav, kým sa rubrika nezaplní)
  zostávala vpravo prázdna medzera. `repeat(auto-fit, minmax(...))` to rieši
  samo, bez media queries na počet stĺpcov.
- **Hero banner** — obrázok od používateľa (jesenná úroda) nahratý do
  Supabase Storage (`article-images/zahrada/header.webp`), plnošírkový pod
  mastheadom na `zahrada.html`.
- **Obrázky prepnuté na fotorealistický, "vlastná fotka autora" štýl**
  (predtým symbolická "digital art" ilustrácia, nesediaca k záhradkárstvu).
  Dve kolá doladenia — druhé na spätnú väzbu "musia viac sedieť s témou,
  akoby som to fotil ja": prompt teraz opisuje KONKRÉTNU akciu z článku
  (napr. ruky presúvajúce kvetináč), štýl "candid smartphone photo" namiesto
  DSLR/stock vzhľadu. `PHOTOREALISTIC_SECTIONS` množina v `11-image.js` aj
  `images.js` je zámerne rozšíriteľná pre Dom/Byt.
- **Writer prompt prepísaný** podľa podrobného štýlového manuálu od
  používateľa (tón "sused cez plot", zoznam zakázaných AI fráz, SEO
  povedomie). Výstupný JSON kontrakt a kódom-riadené ZDROJE (nie model)
  ostali zámerne nedotknuté — bezpečnostný dôvod vysvetlený priamo v kóde.
  Dĺžka zdvihnutá na 500-900 slov (`maxTokens` 1600→2400).
- **Dva staré publikované články majú ešte starý ilustračný štýl obrázka**
  (predchádzali dnešnej zmene) — používateľ chce ich prefotiť na
  fotorealistické. ROZOBEHNUTÉ, NEDOKONČENÉ: narazilo na priebežný
  rozpočtový strop (`$0.85` minuté, strop na danú hodinu `$0.84`) hneď pri
  prvom Haiku volaní. Presné sheet-riadky nájdené vopred (safe, len čítanie):
  Zalievanie = riadok 391, Výška kosenia trávnika = riadok 404, stĺpec H.
  Žiadna funkcia na UPDATE existujúceho riadku v hárku predtým neexistovala
  (`appendRow`/`appendArticleRow` len pridávajú nové) — treba ju napísať cez
  `spreadsheets.values.update` na `articles!H<riadok>`, používateľ súhlasil
  počkať na uvoľnenie rozpočtu namiesto obchádzania cez Haiku.

- **Vlastný spúšťač, nie facts pipeline.** Vkladá rovno do statusu `proofed`
  — obchádza 01-07 AJ 08 (ten kontroluje článok proti FACTS, ktoré Záhrada
  nemá). 09-legal, 11-image, 12-publisher bežia ďalej, len 09 a 11 majú pre
  `section: 'zahrada'` vlastnú vetvu.
- **09-legal dostal celý nový profil kontrol** (`ZAHRADA_CHECKS`) — riziko
  rubriky nie je zlá atribúcia, je škodlivá rada: prípravky/dávkovanie, huby
  (úplný zákaz), zdravotné tvrdenia o bylinkách, presný dátum namiesto fázy
  rastliny, invázne druhy, usmrtenie stavovca, kúpna výzva. Pôvodné CHECKS
  (krypto/AI/ekonomika/svet) nedotknuté — overené.
- **11-image preskočí generovanie**, keď `article.no_ai_image === true`
  (identifikačné riziko — vygenerovaná voška vyzerá presvedčivo a je
  vymyslená). Zoznam 3 tém + regex ako doplnková poistka, nie regex sám —
  regex nad osnovou mal aj falošné negatíva aj pozitíva, over v komentári
  v `15-zahrada.js` prečo.
- **Používaný slug = navždy, nie len tento rok.** Aktualizačný režim pre
  2. rok (plán ho v hlavičke žiada, aby sa nekanibalizovalo vyhľadávanie)
  ešte nie je postavený — zapísané ako TODO pred 2027-01 priamo v kóde.

Kroky 3-4 (kategória, web) a stav živého testu — pozri hore.

### Rubrika Horoskopy — nová (6. 9. večer), kroky 1-2 hotové

Nová rubrika na žiadosť používateľa, podľa ním zadanej **BIBLIA-HOROSKOP
V1.0** (nie súbor v repozitári — zadanie prišlo priamo v konverzácii, kľúčové
pravidlá sú teraz v `HOROSKOP_SYSTEM` v `16-horoskop.js`). Overené naživo,
že veľké portály horoskop bežne majú (Yahoo, MSN, Pravda.sk/Koktail,
Zoznam.sk/Sibyla) — nie je to mimo profilu spravodajského webu.

Rovnaký architektonický vzor ako Záhrada: vlastný spúšťač, obchádza 01-08
(žiadne fakty na overovanie), rovno do `proofed`. Rozdiel oproti Záhrade:
horoskop nemá ani len register reálnych inštitúcií ako zdroj (ÚKSÚP/SHMÚ)
— je to čistá lifestylová fikcia, čo aj samotná biblia priznáva. Sebaatribúcia
"Novinko — Horoskop" sa skladá kódom, nie modelom.

**KĽÚČOVÉ ARCHITEKTONICKÉ ROZHODNUTIE — 3 volania po 4 znameniach, nie 1
po 12:** prvý pokus (jedno Sonnet volanie na všetkých 12 znamení naraz,
~2500-3500 slov) opakovane zlyhával — najprv `Request timed out` aj po
zdvihnutí `AI_TIMEOUT_MS` z 60s na 120s (lokálny `.env`, negituje sa),
potom orezaný/nevalidný JSON pri `maxTokens: 4000` (model buď nestihol
dokončiť, alebo ho zaťal strop tokenov uprostred). Namiesto ďalšieho
naťahovania stropov (krehké, len odsúva problém o kus ďalej) som generovanie
rozdelil na **3 sekvenčné volania po 4 znameniach**, `maxTokens: 2200`
každé — rýchle, spoľahlivé, ako bonus núti model menej sa v rámci menšej
dávky opakovať. Nadpis a perex sa AI vôbec nepýtajú — biblia sama hovorí
"titulky možno obmieňať", takže sú to rotujúce šablóny v kóde podľa dňa
v mesiaci, zadarmo a bez rizika clickbaitu.

**`HOROSKOP_CHECKS` v `09-legal.js`** — 8 strojových kontrol (istota,
zdravie, tehotenstvo, nevera, hazard, financie, astro-udalosti, zdroje),
druhá vrstva popri prompte, rovnaký princíp ako `ZAHRADA_CHECKS`. Pri
testovaní chytený a opravený falošný pozitív: `spln\w*` (astrologický
spln mesiaca) chytal aj úplne bežné slovo "splnený" ("Jeden splnený
úloha... deň") — opravené na `spln(?![\p{L}])`, presnú hranicu slova.
Redakčná poznámka (biblia kapitola 16, "horoskop je určený na zábavné a
lifestylové účely...") sa pripája kódom za posledné znamenie, nie modelom.

**Overené reálnym behom** (3 Sonnet volania, ~$0,05, 98s spolu): 12 znamení,
každé s odlišnou témou a vetnou štruktúrou, žiadne AI klišé, hviezdičkové
hodnotenia prirodzene rozložené (nie samé 4-5), prešlo cez `09-legal` bez
zásahu po oprave regexu.

**Zostáva (krok 3-4, mimo dnešného rozsahu):**
- Obrázok — dohodnuté: symbolická nebeská/zverokruhová ilustrácia (rovnaká
  neFoto vetva ako krypto/AI v `11-image.js`), NIE fotorealizmus ako Záhrada
  — niet čo reálne odfotiť. Ešte nezapojené.
- Kategória (`CATS`, `POVOLENE_KATEGORIE`, `buildAll()` špeciálny riadok
  ako pri Záhrade/Krypto škole) — ešte nezapojené.
- Vlastná stránka `horoskop.html` — používateľ chce "web vo webe" ako
  Záhrada, ešte nepostavená.
- Nikdy nebežal cez `run-pipeline.mjs` naostro (len ručné volanie
  `napisHoroskop()` priamo) — je zapojený (`16-horoskop.js` importovaný
  a volaný), ale prvý ostrý beh treba sledovať zblízka, rovnako ako pri
  Záhrade/Ekonomike/Svete.

### Ďalej v poradí

1. Os **potvrdené/rumor** vo faktoch — dnes leak vyzerá ako hotový fakt.
   Zmena schémy, dotkne sa `05`, `07` aj `09`. **Je to predpoklad pre sekciu
   Svet**, nie nezávislá úloha: vojnové spravodajstvo bez rozlíšenia
   „potvrdené / tvrdenie jednej strany / neoverené" sa písať nedá. Ekonomika
   na to už odpilotovala jednoduchú verziu (pole `status` — flash odhad vs.
   revízia vs. prognóza), lenže tam stav označuje sám štatistický úrad; pri
   vojne to za nás neurobí nikto.
2. **Koncentrácia na PR wire** — Chainwire nesie 55 % krypto obsahu. Nie je to
   promptový problém, ale rozhodnutie v `feeds.js` / `06`.
3. **E-maily `@novinko.sk`** — jedna schránka `redakcia@` + aliasy `tipy`,
   `oprava`, `dsa`, `sukromie`. Adresy na právnych stránkach prepnúť AŽ po
   otestovaní schránok; Gmail nechať presmerovaný. Over, či je kontakt súčasťou
   registrovaných údajov k EV 176/26/SWP.
4. **Spiaci stroj** — nevyriešené od 9. 8.
5. **Evidenčné číslo** chýba na stránkach článkov, kde ľudia z Googlu pristávajú.
6. ~~`07-writer.js` claim() je FIFO bez ohľadu na sekciu~~ **OPRAVENÉ 6. 9.
   večer** — `claimPerSection()` claimuje osobitne za každú živú sekciu,
   viď sekcia Svet vyššie. Ostáva overiť na živej prevádzke (nie len v DB
   dry-run čítaní), či sa Svet naozaj pravidelne dostáva na rad, keď pribudne
   ďalšia hlboká sekcia (Horoskop nižšie do tohto poolu nepatrí — vlastný
   spúšťač, nie Writer).
7. **Záhrada: oblasť/typ metadata sa nedostane na web** (nájdené 6. 9.) —
   `zahrada.html` nevie ukázať štítky úžitková/okrasná/izbovky/trávnik ani
   kedy/ako/prečo, hoci schválený artefakt ich mal. Dôvod: hárok (stĺpce A:I)
   pre ne nemá miesto a `articleToRow()` ich nepíše. Pridanie = zmena schémy
   hárku, dotkne sa `netlify/lib/article-row.js` AJ
   `redakcia/lib/_shared/article-row.js` (tá istá dvojitá cesta, pred ktorou
   varuje časť „Čo bolí" vyššie) — nerobiť to mimochodom pri inej úlohe.

Úzkym hrdlom **nie je technika** — je to prevádzka (kredit) a obsah.

## Kde je história

**Git log je hlavný záznam.** Commit správy sú zámerne podrobné — vysvetľujú príčinu,
nie len zmenu. Keď nechápeš, prečo je niečo tak, ako je, `git log -p <súbor>` odpovie
skôr než kód.

**Pamäť** (`~/.claude/projects/.../memory/`) drží veci, ktoré v repozitári nie sú:
rozpočtové obmedzenia, prevádzkové pasce Websupport + Netlify, editorské pravidlá.

**Ostatné dokumenty:** `redakcia/CLAUDE.md` (pipeline), `redakcia/STAV-PROJEKTU.txt`,
`README-ZMENY.md` (historický refaktor v2 — popisuje minulosť, nie súčasnosť).

## Konvencie

- Nepushuj a necommituj bez vyžiadania. Push si robí sám z vlastného terminálu —
  v tomto prostredí nie sú prihlasovacie údaje ku GitHubu.
- Pred nevratným krokom (mazanie obsahu, prepis hárku) urob zálohu a ukáž, čo sa stane.
- Overuj naživo, nie predpokladom. `curl`, `dig`, priame volanie funkcie — a povedz,
  čo si overil a čo nie.
