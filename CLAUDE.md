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
- **Indexovanie:** Search Console overená, sitemap odoslaná (16. 8. 2026)
- **AI transparentnosť:** tagline v hlavičke, popisky pod obrázkami, impressum §6
- **Pipeline:** hodinový cron na používateľovom desktope, NIE v cloude

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
