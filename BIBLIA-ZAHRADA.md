# Biblia rubriky — ZÁHRADA

> Stav: **rozhodnutia uzavreté 2026-08-29**, implementácia ešte nezačala.
> Nadväzuje na `CLAUDE.md` v koreni a `redakcia/CLAUDE.md`. Kde sa rozchádzajú,
> platia tie — táto biblia rieši len rubriku Záhrada.

---

## 1. Čo to je

Nová rubrika na novinko.sk s vlastnou sekciou. Články vznikajú dvoma cestami:

```
AI generátor  →  Telegram na schválenie  →  hárok  →  web
publikovat.html (ručne, človek)          →  hárok  →  web
```

Obe cesty končia v tom istom Google hárku, rovnako ako všetko ostatné na
Novinku. Hárok ostáva jediným zdrojom pravdy o obsahu.

## 2. Prečo to dáva zmysel (a prečo viac než krypto)

Toto nie je len ďalšia sekcia. Je to iný typ obsahu a ten rozdiel hrá pre nás:

| | krypto / AI | záhrada |
|---|---|---|
| životnosť článku | hodiny až dni | **roky** |
| konkurencia v slovenčine | vysoká, prekladá to každý | **tenká** |
| závislosť na cudzích zdrojoch | vysoká (agregácia) | **nízka, je to know-how** |
| sezónnosť dopytu | žiadna | **predvídateľná** |

Search Console k 21. 8. 2026 hovorí, že Google zaindexoval 32 stránok
a 130 nechal v stave „Objavené – momentálne nie je v indexe". Príčinou je
crawl budget na mladej doméne, nie kvalita. Ale dlhodobo platí, že
prerozprávanie správy z The Verge nemá dôvod prežiť — kým „kedy strihať
jablone" má hodnotu každý marec znova.

**Záhrada je preto strategicky lepšia stávka než ďalšie krypto správy.**

## 3. Prečo NEZAPADÁ do existujúcej pipeline

Toto je najdôležitejšia časť dokumentu. Existujúca redakcia je postavená na
udalostiach:

```
01-scout (RSS/CoinGecko) → 02-gateway (čerstvosť + dedup) → 04-collector
→ 05-verification (facts JSON) → 06-chief-editor → 07-writer
```

Záhradkárstvo **nemá udalosti**. Nikto nevydá tlačovú správu „práve nastal čas
na rez ríbezlí". Keby sme pustili záhradkárske RSS do `01-scout`, dostaneme
cudzie články na prerozprávanie — teda presne to, čo je na weboch najslabšie
a čo Google indexuje najneochotnejšie.

Rovnako `02-gateway` s `FEED_MAX_AGE_DAYS` by evergreen obsah zahodil ako
starý. A `05-verification` extrahuje fakty z udalosti — pri rade „zaštipni
vrchol paradajky" niet čo extrahovať.

**Záhrada preto potrebuje vlastný spúšťač.**

## 4. Navrhovaný model: sezónny plán tém

Namiesto feedu stojí rubrika na **kalendári tém**, súbore v repozitári:

```
redakcia/content/zahrada/plan.md     ← témy s obdobím platnosti
redakcia/content/zahrada/*.md        ← hotové články (ako krypto-skola)
```

Každá téma nesie okno, kedy je aktuálna:

```
---
slug: rez-jabloni
obdobie: 02-15 .. 03-31        # od–do, opakuje sa každý rok
titulok: Kedy a ako strihať jablone
priorita: 1
---
Osnova, o čom článok má byť. Nie hotový text — vstup pre generátor.
```

Generátor sa raz denne pozrie, ktoré témy sú v okne, vyberie tú s najvyššou
prioritou, ktorá ešte nebola tento rok použitá, napíše článok a pošle ho do
Telegramu. Rovnaký princíp „ktorá sa najdlhšie neukázala", aký už používa
`evergreen.js` pri Krypto škole — ten stav sa číta z fronty, nie z extra
súboru, a tu to bude rovnako.

**Prečo plán a nie voľné generovanie:** bez neho by AI písala, čo ju napadne,
témy by sa opakovali a v januári by prišiel článok o zbere paradajok. Plán je
zároveň miesto, kde ty rozhoduješ, o čom web je — nie model.

### Čo generátor NEROBÍ
- nevymýšľa si témy mimo plánu
- nepíše o počasí a aktuálnych udalostiach (na to je spravodajstvo)
- nepublikuje bez tvojho kliknutia v Telegrame (`MANUAL_APPROVAL` platí aj tu)

## 5. Právne hranice — TVRDÉ PRAVIDLÁ

Krypto a AI majú v `redakcia/CLAUDE.md` legal architektúru postavenú proti
kopírovaniu cudzieho textu. Záhrada má **iné riziko: škodlivá rada.**

**Prípravky na ochranu rastlín (postreky, herbicídy).**
Generátor **nesmie** odporúčať konkrétny prípravok, dávkovanie ani ochrannú
dobu. V SR smú byť použité len prípravky registrované ÚKSÚP-om a záväzný je
text na etikete, nie článok. Píše sa všeobecne („na túto chorobu existujú
registrované fungicídy, riaď sa etiketou a registrom ÚKSÚP") a nikdy konkrétne.

**Jedlé a jedovaté rastliny.**
Žiadny článok neurčuje rastlinu ako jedlú na základe popisu. Huby sa
nespracúvajú vôbec — zámena je smrteľná a text ju nemôže vylúčiť.

**Zdravotné tvrdenia.**
Bylinky sa opisujú ako rastliny, nie ako liek. Zákaz tvrdení typu „lieči",
„pomáha na", „znižuje". EU nariadenie 1924/2006 platí aj na článok, nielen na
obal.

**Termíny a čísla.**
Rez, výsev a hnojenie sa uvádzajú ako rozpätie viazané na fázu rastliny alebo
teplotu, nie ako presný dátum. Slovensko má viac klimatických oblastí a
„15. marca" je pre Kežmarok aj Štúrovo naraz nesprávne.

> Tieto pravidlá idú do promptu generátora **aj** do kontrolného kroku, ktorý
> ich overí pred odoslaním do Telegramu. Jedna vrstva nestačí — model
> inštrukciu občas obíde.

## 6. Čo treba zapojiť

Nová kategória sa dotkne týchto miest. Ani jedno nie je voliteľné — vynechanie
znamená, že článok skončí v sekcii, ktorú web nepozná, a nikde sa nezobrazí:

| súbor | čo |
|---|---|
| `netlify/lib/config.js` | `CATS` — pridať `zahrada` |
| `netlify/functions/manual-publish.js` | `POVOLENE_KATEGORIE` — inak formulár ticho prepíše kategóriu na `krypto` |
| `index.html` | filter v hlavičke (`data-cat`) + vykreslenie sekcie |
| `redakcia/lib/_shared/feeds.js` | **nič** — Záhrada nemá feedy, to je zámer |
| nový `redakcia/lib/flow/15-zahrada.js` | generátor podľa plánu |
| `redakcia/scripts/run-pipeline.mjs` | zavolať generátor raz denne, nie každú hodinu |

Telegram schvaľovanie a `publikovat.html` netreba stavať — **oboje už
existuje** a stačí ich pustiť k novej kategórii.

## 7. Náklady

`CLAUDE.md` žiada uviesť cenu pri každom návrhu, ktorý pridáva AI volania.

Jeden článok denne cez Sonnet vyjde rádovo na **$0,01–0,02**, teda
**~$0,45/mesiac**. Obrázok cez Flux Schnell ~$0,003 za kus, teda ~$0,09.
Spolu **pod pol dolára mesačne** — proti súčasným ~$29 je to zanedbateľné.

Netlify deploy sa nepridáva: rubrika beží cez existujúce funkcie a hárok,
takže žiadny build navyše.

## 8. Uzavreté rozhodnutia (2026-08-29)

**Objem: jeden článok denne, maximum.** Radšej 30 dobrých za mesiac než 150
priemerných. Objem je pri AI obsahu presne to, čo Google trestá ako „scaled
content abuse".

**Rozsah: všetko** — úžitková aj okrasná záhrada, izbové rastliny, trávnik.
Plán tém musí pokrývať celý rok vo všetkých štyroch oblastiach, inak sa
v zime rubrika vyprázdni (úžitková záhrada od novembra do februára mlčí,
izbovky a plánovanie nie).

**Meno: „Záhrada"**, slug `zahrada`.
„Záhradkár" je meno osoby, nie témy, a zužuje rubriku na personu. Navyše je to
— over si to — názov dlhoročného slovenského časopisu, teda pravdepodobne
ochranná známka. „Záhrada" to riziko nemá a v navigácii sedí ku Svet /
Slovensko / Krypto / AI / Šport.

**Obrázky: AI ilustrácia LEN ako atmosférická hlavička.**
Keď hodnota článku stojí na tom, že čitateľ niečo **rozpozná** — škodcu,
chorobu, odrodu — AI obrázok tam nepatrí. Vygenerovaná voška vyzerá
presvedčivo a je vymyslená; čitateľ podľa nej koná. Vtedy vlastná fotka cez
`publikovat.html`, alebo radšej žiadna.
Do promptu generátora ide zákaz zobrazovať konkrétnych škodcov, choroby
a určovacie znaky. Označovanie AI pôvodu rieši už existujúca logika podľa
priečinka (`manual/` verzus `krypto/`, `ai/`).

**Autor: „tím Novinko"** — rovnako ako pri krypte a AI.

```
JSON-LD author:  { "@type": "Organization", "name": "Novinko" }
byline:          „tím Novinko"          ← už to takto robí renderClanok()
```

Zvažovalo sa uviesť menom človeka, ktorý článok schvaľuje v Telegrame —
skutočný menovaný autor je pre Google (E-E-A-T) silnejší signál než
organizácia. Rozhodnutie padlo na „tím Novinko", lebo je **konzistentné so
zvyškom webu** a nevyžaduje zverejniť osobné meno. Je to slabší, ale poctivý
signál; dá sa zmeniť neskôr, ak k rubrike pribudne skutočný odborník.

**Vymyslený ľudský autor je zakázaný.** Žiadna fiktívna „záhradníčka
s 20-ročnou praxou". Je to fabrikácia, pri odhalení berie dôveru celému webu
a ide priamo proti tomu, na čom Novinko stojí — „Píše AI. Človek kontroluje."
Podľa `CLAUDE.md` práve manuálne schvaľovanie drží výnimku v Článku 50 AI Act;
falošný autor ju spochybňuje.

Rozdiel oproti fabrikácii je podstatný: „tím Novinko" nikomu nepripisuje
odbornosť, ktorú nemá. Vymyslená „záhradníčka s 20-ročnou praxou" áno — a to
je čiara, ktorá sa neprekračuje.

## 9. Zobrazenie na hlavnej stránke

Rozhodnuté 2026-08-29. Vzor už na hlavnej **existuje** a stačí ho nasledovať —
`index.html` má dnes toto:

```js
const SECTIONS = [ …, { id: 'sport', label: 'Šport', tier: 2 } ];
const EDU = { id: 'krypto-skola', label: 'Krypto škola' };   // ← MIMO SECTIONS
const LEAD_SECTIONS = ['krypto', 'ai', 'slovensko'];
```

Krypto škola zámerne nie je medzi spravodajskými sekciami — má vlastný blok
`.skola-section` s trojkartovou mriežkou a vlastnú farbu. Záhrada ide rovnakou
cestou.

**Prečo nie medzi sekcie:** evergreen zamiešaný medzi novinky prehráva dvakrát.
Ako novinka je starý, ako evergreen sa stratí. Navyše hlavná radí podľa
`MAX_AGE_HOURS = 48` — záhradný článok by po dvoch dňoch spadol dole, hoci má
hodnotu ešte mesiac.

### Kľúčový rozdiel oproti Krypto škole

Krypto škola rotuje podľa „ktorá sa najdlhšie neukázala". Pri šiestich
článkoch to stačí. Záhrada ich bude mať ~365 ročne a rotácia by v marci
vytiahla článok o zbere jabĺk.

> **Záhrada sa na hlavnej radí podľa SEZÓNNEHO OKNA — nie podľa čerstvosti
> ani podľa rotácie.**

Blok „Sezóna v záhrade" zobrazí 3–4 články, ktorých `obdobie` (viď kapitola 4)
zahŕňa dnešný dátum. Je to zároveň jediné radenie, ktoré dáva čitateľovi
zmysel: v marci chce rez, nie zber.

### Konkrétne zmeny v `index.html`

| čo | ako |
|---|---|
| `SECTIONS` | **nepridávať** |
| nová konštanta vedľa `EDU` | `const ZAHRADA = { id: 'zahrada', label: 'Záhrada' }` |
| `LEAD_SECTIONS` | **nepridávať** — hlavnú správu dňa nerobí článok o paradajkách |
| navigačné filtre (`data-cat`) | **pridať** — na rozdiel od Krypto školy; pri stovkách článkov musí ísť rubriku prezrieť |
| `CAT_LABELS` | `zahrada: 'Záhrada'` |
| CSS premenné | `--cat-zahrada` v svetlej aj tmavej téme + `.label-zahrada` |
| blok | podľa vzoru `.skola-section` / `.skola-grid` / `.skola-card` |

### Čo sa ZÁMERNE nerobí

**Hlavná stránka sa neprepisuje na serverové vykresľovanie.** Má dnes v surovom
HTML 635 znakov a nula odkazov na články — všetko skladá JavaScript. Je to
reálny problém, ale riešiť ho teraz by bola chyba:

- `/archiv` (funkcia, od 2026-08-29) už dáva Googlu cestu ku všetkým článkom
  a je linkovaný z pätičky hlavnej aj každého článku
- `index.html` je statický súbor, teda zadarmo z CDN; funkcia by
  z najnavštevovanejšej stránky spravila compute pri každom požiadaní
- **ešte nevieme, či archív zabral** — dáta v Search Console meškajú týždeň

Prepisovať najnavštevovanejšiu stránku skôr, než uvidíme efekt lacnejšej
zmeny, je zbytočné riziko aj náklad. Vrátiť sa k tomu **okolo 2026-09-12**
s číslami z Search Console.

## 10. Poradie implementácie

1. **Plán tém** — `redakcia/content/zahrada/plan.md`, pokrytie celého roka
2. **Generátor** — `redakcia/lib/flow/15-zahrada.js` + volanie raz denne
3. **Zapojenie kategórie** — `CATS`, `POVOLENE_KATEGORIE` (viď kapitola 6)
4. **Až potom zobrazenie na hlavnej**

Toto poradie je zámerné: prázdny blok „Sezóna v záhrade" na živom webe
nechceš. Kroky 1–3 sa dajú overiť bez toho, aby o rubrike ktokoľvek vedel —
článok príde do Telegramu a ty ho buď schválíš, alebo nie.

## Čo NEROBIŤ (poučenia, ktoré už web stáli čas)

- ❌ Nepridávaj záhradkárske RSS do `feeds.js`. Prerozprávanie cudzích
  záhradkárskych článkov je presne to, čo tomuto webu neprospieva.
- ❌ Nezapájaj to do `01-scout`/`02-gateway`. Gateway zahodí evergreen ako
  starý (`FEED_MAX_AGE_DAYS`) a nikdy sa nedozvieš prečo.
- ❌ Nepridávaj kategóriu len do `CATS` a nie do `POVOLENE_KATEGORIE`.
  Formulár ju potom ticho prepíše na `krypto` — je to natvrdo v kóde.
- ❌ Nepridávaj `zahrada` do `SECTIONS` ani `LEAD_SECTIONS`. Viď kapitola 9.
- ❌ Nestav zobrazenie na hlavnej skôr než generátor — mal by si prázdny blok.
- ❌ Nevymýšľaj ľudského autora ani „odborného garanta". Viď rozhodnutie 5.
- ❌ Nespúšťaj generátor každú hodinu. Pipeline beží hodinovo, ale Záhrada
  má bežať raz denne — inak vyrobí 24 článkov za deň.
- ❌ Nevypínaj `MANUAL_APPROVAL`. Pri radách, ktoré niekto použije v záhrade,
  je človek pred publikovaním to jediné, čo stojí medzi chybou modelu a
  poškodenou úrodou.
