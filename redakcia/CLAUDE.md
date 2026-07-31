# CLAUDE.md — Novinko Redakcia

> Event-driven editorial pipeline (News OS) pre slovenský AI spravodajský agregátor.
> Píšem v slovenčine, kód a komentáre v angličtine. Buď priamy, žiadne generické povzbudzovanie — radšej čestný odborný pushback.

## Čo to je

Samostatný projekt (NIE ten istý Supabase ako pôvodné Novinko `sndnglmrpgdzwdilgapj`).
Agenti sú špecialisti, ktorí spolu komunikujú VÝHRADNE cez zmeny statusu v Supabase fronte.
Žiadne priame volania medzi agentmi — vždy len cez queue.

**Princíp: "Software First, AI Second."** AI je najdrahšia vrstva, používa sa až keď lacnejšie zlyhá.

## Queue stavy (presné poradie pipeline)

```
raw → filtered → collected → facts_ready → clustered →
written → proofed → legal_ok → seo_done → imaged → published
```

Každý agent berie položky v jednom vstupnom statuse a posúva ich do ďalšieho.
Nikdy nepreskakuj stav. Nikdy nemeň status mimo vlastnej zodpovednosti agenta.

**Stav reťaze (2026-07-31):** `seo_done` je JEDINÝ, ktorý sa zatiaľ preskakuje —
`10-seo` je stub, takže `09-legal` posiela rovno do `legal_ok` a `11-image`
odtiaľ berie. Kroky `08` a `09` sú od 31.7.2026 implementované a bežia.
Do 31.7.2026 sa preskakovali všetky tri (08, 09, 10) a `11-image` čítal rovno
`written` — nebežala teda žiadna korektúra ani právna kontrola. Neopakuj to:
keď pridávaš krok, VŽDY skontroluj, či naň nadväzujúci krok mení svoj `input`.

## Štruktúra projektu (1:1 s NovaCore NEWS FLOW)

```
lib/
  flow/
    01-scout.js ... 14-learning-engine.js   # číslované, jeden agent = jeden súbor
  _shared/
    queue.js        # čítanie/zápis do fronty, zmeny statusu
    ai-gateway.js   # JEDINÝ vstupný bod pre Anthropic API
    cost.js         # tracking nákladov na AI
    sources.js      # definície zdrojov
db/
  schema.sql        # spustiť v novom Supabase pred čímkoľvek
```

## ⚖️ Legal architektúra (KRITICKÉ — neporušovať)

- **Writer (`07-writer.js`) dostáva LEN štruktúrované facts JSON, NIKDY zdrojový text.**
- Fact Extractor (`05-verification.js`) je preto právny aj technický základný kameň.
- Nikdy neposúvaj surový text článku do Writera. Nikdy needituj túto hranicu bez explicitného potvrdenia.

### Sourcing model: PRIMARY + ATRIBUOVANÁ AGREGÁCIA (Model 2)

Cieľ: vyzerať ako profesionálny krypto denník (CoinDesk, Cointelegraph) bez kopírovania cudzieho obsahu.

- **Jadro = primárne zdroje.** Keď niečo oznámi firma/projekt/regulátor, ideš na PRIMÁRNY zdroj
  (oficiálny blog, PR, filing, on-chain dáta), nie na to, ako to prerozprávalo médium.
- **Sekundárne médium len s ATRIBÚCIOU.** Ak správu prvé zachytí médium, reportuješ *fakt, že to oznámili*
  — „podľa X" + link + max. krátka citácia (fair use). NIKDY tichý rewrite cudzieho článku.
- **Dôsledok pre facts JSON:** každý fakt MUSÍ niesť atribúciu — `source_name`, `source_url`
  a flag `source_type: primary | secondary`. Writer podľa toho vie, kedy musí napísať „podľa X".
- Model 3 (tichý rewrite médií „vlastnými slovami") je ZAKÁZANÝ — proti tomu celá táto architektúra stojí.

## Build poradie (aktuálny stav)

1. Spustiť `db/schema.sql` + `sources` tabuľku v NOVOM Supabase
2. `05-verification.js` — Fact Extractor (legally critical, prvá priorita) ✅
3. `07-writer.js` — Writer (číta len facts JSON) ✅
4. `06-chief-editor.js` — Chief Editor ✅

Learning Engine (`14`) je odložený, kým nebudú reálne publikačné dáta.

**VSTUPNÁ STRANA — LIVE:**
- `01-scout` ťahá CoinGecko (Layer A) + RSS/Atom feedy (Layer B/C).
- **Pridať zdroj = pridať riadok do `lib/_shared/feeds.js`** (text) alebo upraviť `coingecko.js`.
- `02-gateway`: Layer A prah `MIN_MOVE_PCT`, feedy `FEED_MAX_AGE_DAYS` + dedup.
- `04-collector`: normalizuje oba zdroje na facts kontrakt.
- Celá pipeline: `node --env-file=.env scripts/run-pipeline.mjs`.

**ODLOŽENÉ (nezabudnúť):**
- `06` newsworthiness brána je zatiaľ LEN software (prah `MIN_PCT_MOVE`, `ALWAYS_WORTHY`).
  Fáza 2 = AI (Haiku) na hraničné prípady — doplniť AŽ po reálnych dátach, na označenom
  `TODO` v `assessNewsworthiness()`. Dovtedy prahy ladíš konštantami navrchu súboru.
- `06` zaviedol terminálny status `merged` (pohltené položky clusteru) — je v `schema.sql`.

## AI cost layers (poradie eskalácie)

```
regex / keywords  →  Haiku  →  Sonnet  →  drahší model (len keď nutné)
```

Vždy skús lacnejšiu vrstvu prvú. Každé AI volanie ide cez `ai-gateway.js` a loguje sa do `cost.js`.

## Scope na launch: KRYPTO ONLY

Všetky zdroje nižšie sú PRIMÁRNE (legálne čisté jadro). Sekundárne médiá sa pridávajú len
cez atribuovanú agregáciu — pozri Sourcing model v Legal architektúre.

- **Layer A (dáta):** DexScreener, CoinGecko, DefiLlama, GeckoTerminal
  → štruktúrované čísla, NIE chránený text. Mapuj kódom (regex), AI len keď zlyhá.
- **Layer B (primárne oznámenia, text):** GitHub release feeds, oficiálne projekt/foundation blogy
- **Layer C (rozšírené primárne zdroje):**
  - Exchange/firemné blogy a announcements (Coinbase, Binance, Kraken…)
  - Regulátori a súdy (SEC, EU/MiCA, press releases, filings — verejné, nechránené)
  - Governance (Snapshot, Tally — DAO hlasovania, verejné on-chain)
  - Oficiálne PR wires / tlačové správy

Video-to-text pipeline (slovenský politický obsah): MVP = oficiálne textové prepisy NR SR (bez ASR).
Whisper pre tlačovky až v neskoršej fáze. Zatiaľ NEpridávať ASR.

## Bezpečnostné brány

- `MANUAL_APPROVAL=true` — počiatočná poistka, nič sa nepublikuje automaticky.
- Pred publikovaním (`legal_ok` → ďalej) musí prejsť manuálne schválenie.

## Stack & deploy

- Node.js, Netlify Functions, Supabase, Anthropic API
- Deploy: Netlify + GitHub CI/CD
- Lokálne: Ubuntu, PM2 pre dlhobežiace procesy

## DON'T (anti-patterns)

- ❌ Nemiešaj s pôvodným Novinko Supabase `sndnglmrpgdzwdilgapj`.
- ❌ Neposielaj zdrojový text do Writera — len facts JSON.
- ❌ Nevolaj Anthropic API priamo, vždy cez `ai-gateway.js`.
- ❌ Nepoužívaj drahý model, keď stačí regex/Haiku.
- ❌ Nepridávaj Whisper/ASR do MVP.
- ❌ Neobchádzaj queue — žiadna priama komunikácia medzi agentmi.
- ❌ Nepublikuj nič, kým je `MANUAL_APPROVAL=true`.
- ❌ Netichý rewrite cudzích článkov (Model 3) — sekundárne médium VŽDY len s atribúciou „podľa X" + link.
- ❌ Neukladaj fakt bez atribúcie — každý fakt nesie `source_name`, `source_url`, `source_type`.

## Konvencie

- Číslované súbory v `lib/flow/` zodpovedajú NovaCore krokom — zachovaj číslovanie.
- Keď ma opravíš a ja niečo robím zle, navrhni pridať pravidlo sem do CLAUDE.md.
- Keď niečo nie je jasné v architektúre, opýtaj sa skôr, než to implementuješ.
