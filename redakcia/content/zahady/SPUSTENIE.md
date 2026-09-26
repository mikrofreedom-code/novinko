# Príprava a spustenie rubriky

Tento súbor je prevádzkový postup, nie povolenie na produkčné nasadenie.

Aktualizácia 26. 9. 2026: dizajn rubriky a import konceptov sú nasadené.
Tri nezverejnené články a postup importu sú v [start/README.md](start/README.md).
Lokálny náhľad: `node scripts/preview-zahady.cjs` z koreňa projektu.

Produkčný deploy: `6ab7cf87d79aa551663aaddf` (Netlify CLI, lokálny build).
Predchádzajúci deploy pre návrat: `6ab04d3798aae3000876e12b`.
Overené na novinko.sk: rubrika, formulár s importom, JS a obrázok vracajú 200;
API rubriky vracia platný prázdny zoznam; sitemap obsahuje rubriku;
súkromný JSON konceptu vracia 404. Články neboli publikované.
Nasadenie prebehlo priamo z lokálneho buildu. Tento súbor je súčasťou
commitu nasadenej verzie; push do `origin/main` vykoná používateľ manuálne.

Stav k 25. 9. 2026: migrácia je aplikovaná v projekte `novinko-redakcia`
(`kypwhjpedbtodehrviub`). Obe tabuľky majú zapnuté RLS a nemajú verejnú
politiku. V Google Sheete má bunka J1 hodnotu `metadata_json` a publikovaný
CSV export vracia nový stĺpec. Kód webu bol nasadený 26. 9. 2026.

1. V Supabase aplikovať migráciu `db/migrations/20260925_zahady_topics.sql`.
   Overiť, že tabuľky `public.mystery_topics` a `public.mystery_topic_articles`
   majú RLS a nemajú verejnú politiku.
2. V Google Sheete `articles` pridať hlavičku `metadata_json` do stĺpca J.
   Existujúce riadky A:I nechať bez zmien. Overiť, že publikovaný CSV export
   po skúšobnom zápise naozaj vracia aj J.
3. Nasadiť kód webu a funkcií v jednom deployi. Výstup buildu publikuje
   `zahady.html` automaticky spolu s ostatnými HTML stránkami.
4. Na testovacom prostredí publikovať jeden skúšobný článok s dvoma zdrojmi,
   označením legendy a titulným obrázkom. Overiť formulár, rubriku, článok,
   sitemap, archív, Google Sheet J a záznam v Supabase.
5. Overiť odmietnutie duplicitnej témy a aktualizáciu existujúceho článku.
   Adresa a ID aktualizovaného článku musia zostať rovnaké.
6. Po publikovaní viacerých článkov možno opraviť zrkadlo tém príkazom
   `node --env-file=.env scripts/sync-zahady-topics.mjs --apply` z priečinka
   `redakcia/`. Bez `--apply` skript iba spočíta kandidátov.

Ak zlyhá zrkadlenie do Supabase po zápise článku, formulár oznámi úspešné
publikovanie a upozorní na dosynchronizovanie. **Neklikaj znovu na Publikovať**:
v hárku by vznikol druhý článok. Použi synchronizačný skript.

AI generovanie nie je súčasťou tohto spustenia. Neskôr použije existujúce
témy a rovnaký publikačný formát, no potrebuje samostatnú výskumnú a
schvaľovaciu pipeline.
