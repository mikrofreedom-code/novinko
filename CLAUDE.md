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
  14.–18. 8. bežalo 24 behov denne bez výpadku.
- **Náklady (merané 19. 8.):** AI $0.625/deň ≈ $19/mes + Replicate ~$1.35
  + Netlify $9 → **~$29/mesiac**. Denný strop $0.80 sa nedosahuje.

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

### 🔴 REDAKCIA NEPÍŠE — najprv toto, zvyšok je bezpredmetný

**Anthropic účet nemá kredit.** Posledné úspešné AI volanie **24. 8. o 12:01**,
posledný publikovaný článok **27. 8.** Cron beží ďalej, scout zbiera, gateway
filtruje — ale všetko, čo dorazí k `05-verification`, spadne na
`credit balance is too low`.

- **457 položiek visí v `error`** s týmto dôvodom (merané 5. 9., rastie).
- **`retry.js` ich už po dobití zachráni** — opravené 5. 9. Nedostatok kreditu
  má vlastnú vetvu, rovnako ako budget guard: nepočíta sa do `MAX_RETRIES`
  (odmietnutý pokus na nulový kredit nič nestojí), takže sa skúša znova pri
  každom behu, kým sa účet nedobije. Predtým sa chyba netrafila do `TRANSIENT`
  regexu a položka zostala v `error` navždy.
- Väčšina tých položiek je staršia než `CLUSTERED_MAX_AGE_H = 24`, takže by ich
  Writer aj tak zahodil. Reálne prežijú len tie najčerstvejšie.

### Sekcia Ekonomika — postavená, ZATIAĽ NEŽIVÁ (5. 9.)

Celá reťaz je hotová a commitnutá, ale `live: false` v `lib/sections/index.js`.
`liveFor()` gatuje Writera, takže sa položky zbierajú, extrahujú a skórujú, ale
**nenapíše sa ani nezaplatí žiadny článok**. Je to zámerný pilot: extrakcia
(lacná, Haiku) beží a plní `clustered`, písanie (Sonnet, najdrahšia vrstva) nie
— takže sa dá pozerať na reálne `facts` JSON skôr, než sa zaplatí prvý článok.
Web je pripravený — tab
„Ekonomika", `CAT_LABELS` aj farba `--cat-eko` v `index.html` existujú
z ručného publikovania, takže prepnutie NEPOTREBUJE deploy.

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
  pozrieť väčšiu vzorku faktov a podľa nej rozhodnúť o `live: true`.
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
- **Čo zostáva neoverené:** ako vyzerá HOTOVÝ ČLÁNOK. Overená je extrakcia
  (fakty, obdobia, stavy, atribúcia), ale Writer s hospodárskou vetvou promptu
  ešte nebežal ani raz — gatuje ho `live: false`. Prvý zapnutý beh treba
  sledovať zblízka.

### Sekcia Svet — postavená, ZATIAĽ NEŽIVÁ (5. 9.)

Rovnaký stav ako Ekonomika: celá reťaz commitnutá, `live: false`, web tab „Svet"
existuje z ručného publikovania, takže zapnutie nepotrebuje deploy.

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

### Rozpracované, NECOMMITNUTÉ

- **Rubrika Záhrada** — `BIBLIA-ZAHRADA.md` + plán 60 tém, generátor
  `15-zahrada.js` ešte neexistuje.

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
