# Novinko — Redakcia (NovaCore)

AI-asistovaná spravodajská redakcia. Pomenovanie 1:1 podľa NovaCore NEWS FLOW.
Stack: **Netlify Functions + Supabase + Claude API + Flux Schnell**.

> Každý krok flow = jeden súbor v `lib/flow/`, očíslovaný v poradí.
> Chceš niečo vymeniť? Otvor ten jeden súbor. Nič iné sa nedotkne.

---

## NEWS FLOW (presne podľa dokumentu)

```
Scout → Event Gateway → Event Bus → Collector → Verification →
Chief Editor → Writer → Proofreader → Legal → SEO → Image →
Publisher → Analytics → Learning Engine
```

Každý krok zoberie položky vo svojom VSTUPNOM statuse, spraví prácu,
posunie na VÝSTUPNÝ status. Žiadny krok nevolá iný priamo — len mení status.

---

## Mapa krokov (= súbory v lib/flow/)

| #  | Krok            | Súbor                       | vstup→výstup           | Stav          | AI |
|----|-----------------|-----------------------------|------------------------|---------------|----|
| 01 | Scout           | 01-scout.js                 | — → raw                | 🟡 prenos     | 0  |
| 02 | Event Gateway   | 02-event-gateway.js         | raw → filtered         | 🔴 stavať     | 0  |
| 03 | Event Bus       | 03-event-bus.js (_shared)   | infra (transport)      | 🟢 core       | —  |
| 04 | Collector       | 04-collector.js             | filtered → collected   | 🔴 stavať     | 0  |
| 05 | Verification    | 05-verification.js          | collected → facts_ready| 🔴 MVP PRVÝ   | 2  |
| 06 | Chief Editor    | 06-chief-editor.js          | facts_ready → clustered| 🔴 MVP        | 1-2|
| 07 | Writer          | 07-writer.js                | clustered → written    | 🔴 MVP        | 3  |
| 08 | Proofreader     | 08-proofreader.js           | written → proofed      | 🟢 hotové     | 2  |
| 09 | Legal           | 09-legal.js                 | proofed → legal_ok     | 🟢 hotové     | 0  |
| 10 | SEO             | 10-seo.js                   | legal_ok → seo_done    | ⚪ future     | —  |
| 11 | Image           | 11-image.js                 | legal_ok → imaged      | 🟢 máš (Flux) | —  |
| 12 | Publisher       | 12-publisher.js             | imaged → published     | 🟢 máš        | —  |
| 13 | Analytics       | 13-analytics.js             | published → —          | ⚪ future     | —  |
| 14 | Learning Engine | 14-learning-engine.js       | — → —                  | ⚪ future     | —  |

🟢 hotové · 🟡 ľahké/čiastočné · 🔴 stavať teraz · ⚪ future
AI vrstvy: 0=žiadna · 1=lacný klasifikátor · 2=Haiku · 3=Sonnet

---

## Dôležité: kde je "Fact Extractor"?

Dokument NEMÁ samostatný Fact Extractor box. Extrakcia faktov (náš legálne
kritický krok) žije vo **Verification (05)** — tam vzniká JSON faktov a zahodí
sa vyjadrenie zdroja. **Writer (07)** potom vidí LEN tieto fakty, nikdy
pôvodné vety. To je tá právna ochrana, zabudovaná do flow.

---

## Zdieľaná infraštruktúra (lib/_shared/)

- `queue.js`      — Event Bus implementácia (status machine)
- `ai-gateway.js` — agent pýta cheap/smart, model sa mení tu
- `cost.js`       — Cost Engine (log nákladov)
- `sources.js`    — Source Database helper

---

## Build poradie (MVP)

1. `db/schema.sql` + sources do Supabase
2. **Verification (05)** — fakty do JSON (legálne kritický)
3. **Writer (07)** — uzamknutý na fakty
4. **Chief Editor (06)** — clustering

Scout, Image, Publisher prenesieš zo starého Novinka.

---

## Poistka
`.env` → `MANUAL_APPROVAL=true`. Kým je true, Publisher čaká na tvoje
schválenie. Keď 50 článkov po sebe sedí → prepneš na false.
