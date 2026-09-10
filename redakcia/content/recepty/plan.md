# Plán tém — rubrika Recepty

> Vstup pre generátor (`redakcia/lib/flow/17-recepty.js`). Nie hotové recepty —
> osnova je zadanie na rozpísanie, Writer z nej skladá aj presné množstvá
> a postup (tie v pláne zámerne nie sú, aby článok nebol len prepis osnovy).
> Verzia 1 — 2026-09-10. Zámerne UŽŠÍ ZÁBER na štart (na žiadosť používateľa):
> 4 kategórie namiesto celej šírky ako má vzorový recepty.sk (deviatich),
> 16 tém, žiadne magazínové/zdravotné články — len čisté recepty.

## Ako sa to číta

```
slug:     adresa receptu, bez diakritiky, nemenná
obdobie:  MM-DD .. MM-DD, opakuje sa každý rok. Väčšina receptov má ZÁMERNE
          celoročné okno (01-01 .. 12-31) — jedlo nie je také sezónne viazané
          ako záhradkárčenie. Úzke okno majú len recepty, kde sezónnosť
          suroviny/nálady reálne niečo znamená (tekvica, letný šalát).
oblast:   hlavne-jedla | polievky | dezerty | bezmasite-fit
priorita: 1 = kľúčová téma kategórie, 2 = doplnková, 3 = keď je priestor
suvisi:   voliteľné, čiarkou oddelené slugy súvisiacich receptov — interné odkazy.
```

Generátor berie raz denne tému, ktorá je **v okne**, má **najvyššiu prioritu**
a **ešte nebola použitá** (bez ročného orezania — rovnaký princíp ako Záhrada,
viď hlavička `17-recepty.js`).

## Pravidlá pre osnovy (záväzné aj pre Writer, viď 17-recepty.js)

Rovnaká filozofia ako `BIBLIA-ZAHRADA.md` — dve vrstvy (prompt + strojová
kontrola v `09-legal.js`), a čo sem nepatrí, sem radšej vôbec nedávaj:

- **Žiadny surový/nedopečený pokrm** ako téma (tatár, carpaccio, domáca
  majonéza, sushi) — riziko salmonely/E.coli, chce to expertízu, ktorú
  redakcia nemá ako overiť.
- **Žiadny alkohol** ako surovina (rum v torte, víno v omáčke) — vynechané
  v celej V1, nie kvôli chuti, ale aby sa nemuselo riešiť dávkovanie/vek.
  Nealkoholová obmena (napr. jablčný mušt namiesto vína) je v poriadku.
  Doplniť sa dá neskôr ako vlastná kategória s vlastnými pravidlami.
- **Žiadne domáce zaváranie/kvasenie/fermentácia** — nesprávny postup môže
  spôsobiť otravu (botulizmus), jedna redakcia to nedokáže bezpečne pokryť.
- **Žiadne huby** — rovnaký dôvod ako v Záhrade, zámena druhu je smrteľná.
- **Žiadna detská/dojčenská výživa** — iné bezpečnostné hranice (med do
  1 roka, dusenie), mimo rozsahu tejto rubriky.
- **Žiadne zdravotné/liečivé tvrdenia** ("posilňuje imunitu", "spaľuje tuk",
  "detoxikuje") — jedlo je jedlo, nie liek.
- Mäso/hydina/vajcia v postupe VŽDY s jasným znakom prepečenia ("kým mäso nie
  je vo vnútri celkom biele/šťava číra", "kým žĺtok nestuhne") — nie len čas,
  aj vizuálny/hmatový signál, lebo rúry a sporáky sa líšia.
- Čísla (teplota, čas, gramáž) sú tu OK a ŽELANÉ — na rozdiel od Záhrady, kde
  presný dátum klame kvôli klíme, recept BEZ presných množstiev a času by bol
  na nič. Toto pravidlo zo Záhrady sa NEPREBERÁ.

---

<!-- ══════════ HLAVNÉ JEDLÁ ══════════ -->

---
slug: kuracie-prsia-na-paprike-so-slaninou
obdobie: 01-01 .. 12-31
oblast: hlavne-jedla
priorita: 1
suvisi: hovadzi-gulas-klasicky
---
Kuracie prsia zabalené v slanine, dusené na paprikovo-smotanovej omáčke.
Rýchle na všedný deň, ale vyzerá sviatočne. Zdôrazni znak prepečenia kuraťa
(šťava číra, mäso biele skrz naskrz) — nie len minutáž.

---
slug: zapekane-cestoviny-so-syrom-a-sunkou
obdobie: 01-01 .. 12-31
oblast: hlavne-jedla
priorita: 1
---
Klasický zapekaný pokrm pre rodinu — cestoviny, šunka, syrová bešamelová
omáčka, do rúry na zlatavú kôrku. Praktický tip na to, aby cestoviny
nezmäkli — uvariť skôr "na hryz" (al dente), doťahujú sa v rúre.

---
slug: hovadzi-gulas-klasicky
obdobie: 01-01 .. 12-31
oblast: hlavne-jedla
priorita: 2
suvisi: kuracie-prsia-na-paprike-so-slaninou
---
Poctivý hovädzí guláš — dlho dusené mäso, cibuľový základ, sladká paprika.
Vysvetli prečo pomalé dusenie na miernom ohni robí mäso mäkkým (spojivové
tkanivo sa rozpadá až po dlhšom čase, nie rýchlym varom).

---
slug: losos-na-grile-s-citronom
obdobie: 04-01 .. 09-30
oblast: hlavne-jedla
priorita: 2
---
Grilovaný losos s citrónom a bylinkami, ľahká letná večera. Znak
prepečenia rýb (mäso sa ľahko rozpadá na vidličke, stráca sklovitý vzhľad),
tip na to, aby sa koža nepriliepala na rošt.

<!-- ══════════ POLIEVKY ══════════ -->

---
slug: slepacia-polievka-so-zaklandkami
obdobie: 01-01 .. 12-31
oblast: polievky
priorita: 1
---
Domáca slepačia/hovädzia vývarová polievka s pečeňovými alebo krupicovými
knedličkami. Rodinná klasika na nedeľu. Tip na čistý, neskalený vývar
(nevariť na prudkom ohni, pravidelne zbierať penu).

---
slug: tekvicova-krem-polievka
obdobie: 09-01 .. 11-30
oblast: polievky
priorita: 1
suvisi: zelerova-polievka-so-zazvorom
---
Krémová tekvicová polievka so zázvorom a kokosovým mliekom, jesenná
klasika. Tip na rozmixovanie do hladka a na dochutenie — kyslá zložka
(citrón) vyvažuje sladkosť tekvice.

---
slug: zelerova-polievka-so-zazvorom
obdobie: 10-01 .. 03-31
oblast: polievky
priorita: 2
suvisi: tekvicova-krem-polievka
---
Hustá zelerová polievka so zázvorom a jablkom, zimná zahrievacia
polievka. Vysvetli, prečo zázvor pridať až na konci varenia (stratí
ostrosť pri dlhom varení).
---
slug: paradajkova-polievka-s-bazalkou
obdobie: 01-01 .. 12-31
oblast: polievky
priorita: 2
---
Krémová paradajková polievka s čerstvou bazalkou, funguje aj z konzervovaných
paradajok mimo sezóny. Tip na zjemnenie kyslosti štipkou cukru alebo
smotanou, nie sódou bikarbónou (mení chuť).

<!-- ══════════ DEZERTY ══════════ -->

---
slug: jablkovy-kolac-s-drobenkou
obdobie: 09-01 .. 11-30
oblast: dezerty
priorita: 1
---
Jablkový koláč s maslovou drobenkou, jesenná klasika keď sú jablká v sezóne.
Tip na to, aby drobenka zostala chrumkavá a nezmäkla od jablkovej šťavy
(studené maslo, rýchle premiesenie).

---
slug: cokoladovy-fondant
obdobie: 01-01 .. 12-31
oblast: dezerty
priorita: 1
---
Čokoládový fondant s tekutým stredom, efektný dezert na dve porcie.
Presný čas pečenia je tu KĽÚČOVÝ (rozdiel pár desiatok sekúnd rozhoduje
o tekutom strede) — zdôrazni to a daj orientačný rozsah, nie jedno číslo.

---
slug: tvarohovy-kolac-bez-pecenia
obdobie: 05-01 .. 08-31
oblast: dezerty
priorita: 2
---
Nepečený tvarohový koláč s ovocím, ľahký letný dezert bez zapínania rúry.
Tip na tuhnutie v chladničke (minimálne niekoľko hodín, ideálne cez noc)
a na to, prečo želatína/želírovací prášok potrebuje presne dodržaný postup.

---
slug: medovniky-jednoduchy-recept
obdobie: 11-01 .. 12-31
oblast: dezerty
priorita: 2
---
Jednoduché medové perníčky na vianočné pečenie, cesto na vykrajovanie.
Tip na odpočinutie cesta v chladničke (ľahšie sa vaľká, nedrží sa formičiek)
a na to, ako spoznať správnu hustotu cesta.

<!-- ══════════ BEZMÄSITÉ / FIT ══════════ -->

---
slug: quinoa-salat-so-zeleninou
obdobie: 01-01 .. 12-31
oblast: bezmasite-fit
priorita: 1
---
Fit šalát s quinoou, pečenou zeleninou a citrónovo-olivovým dresingom.
Vysvetli prepláchnutie quinoy pred varením (odstráni horkastú povlakovú
látku saponín) a pomer quinoa:voda.

---
slug: pecene-batat-s-ciernou-fazulou
obdobie: 01-01 .. 12-31
oblast: bezmasite-fit
priorita: 1
---
Pečený sladký zemiak (batát) plnený čiernou fazuľou, kukuricou a avokádom,
vydatné vegánske hlavné jedlo. Tip na znak upečenia batátu (vidlička
prejde bez odporu) a na to, prečo fazuľu z konzervy najprv prepláchnuť.

---
slug: cuketove-placky
obdobie: 06-01 .. 09-30
oblast: bezmasite-fit
priorita: 2
---
Chrumkavé cuketové placky, letná klasika keď je cukety veľa. Tip na
odšťavenie nastrúhanej cukety pred vyprážaním (soľ, počkať, vytlačiť) —
inak sa placky rozpadajú a nasajú priveľa oleja.

---
slug: smoothie-bowl-s-ovocim
obdobie: 05-01 .. 09-30
oblast: bezmasite-fit
priorita: 2
---
Smoothie bowl s mrazeným ovocím a toppingmi (ovsené vločky, semienka,
čerstvé ovocie), rýchle raňajky alebo desiata. Tip na hustotu (menej
tekutiny než na pitie smoothie, aby sa dala jesť lyžicou).
