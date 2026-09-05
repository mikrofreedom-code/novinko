# Plán tém — rubrika Záhrada

> Vstup pre generátor (`redakcia/lib/flow/15-zahrada.js`). Nie hotové články.
> Pravidlá, ktoré sa NESMÚ porušiť, sú v `BIBLIA-ZAHRADA.md`, kapitola 5.
> Verzia 2 — 2026-09-07. Verzia 1 (2026-08-29, 60 tém) rozšírená o typ/suvisi/
> zdroje na existujúcich témach, 12 mesačných prehľadov, vyváženie okrasnej
> a trávnika, 2 balkónové témy. 84 tém spolu.

## Ako sa to číta

```
slug:     adresa článku, bez diakritiky, nemenná
obdobie:  MM-DD .. MM-DD, opakuje sa každý rok
oblast:   uzitkova | okrasna | izbovky | travnik | prehlad
priorita: 1 = kľúčová téma sezóny, 2 = doplnková, 3 = keď je priestor
typ:      kedy | ako | preco | prehlad — rozhoduje o tvare článku:
            kedy    → odpoveď HNEĎ v prvej vete (termín/podmienka), potom detail
            ako     → postup v krokoch, kandidát na Schema.org HowTo
            preco   → príznak/otázka → príčina → čo s tým
            prehlad → mesačný súhrn cez všetky oblasti, odkazuje na plné články,
                      nerozvádza detail sám
suvisi:   voliteľné, čiarkou oddelené slugy súvisiacich tém — interné odkazy.
          Musia existovať v tomto súbore, kontroluje sa v plan-check.mjs.
zdroje:   voliteľné, kľúč(e) do ZDROJE v plan-check.mjs (napr. `uksup`, `shmu`).
          Generátor smie uviesť LEN inštitúciu z tohto zoznamu a jej URL —
          nikdy vlastný odkaz. Chýbajúci zdroj neznamená chýbajúcu tému,
          znamená, že sa v nej nevyskytuje nič, čo treba oprieť o autoritu.
```

Generátor berie raz denne tému, ktorá je **v okne**, má **najvyššiu prioritu**
a **tento rok ešte nebola použitá**. Stav sa číta z fronty (`raw_data._src`),
nie z extra súboru — rovnako ako `evergreen.js` pri Krypto škole.

**Druhý a ďalší rok téma NEVZNIKÁ znova pod novým dátumom.** Slug je adresa
navždy — dve URL na tú istú otázku by si navzájom kanibalizovali vyhľadávanie.
V druhom roku generátor existujúci článok **aktualizuje** (nový dátum
„aktualizované", prípadné spresnenie), nepíše ho odznova. Toto rieši
`15-zahrada.js`, plán sa tým nemení.

Obdobia sa zámerne **prekrývajú**. V každom dni roka musí byť v okne aspoň
5 tém, inak generátor nemá z čoho vyberať; kontroluje to `scripts/plan-check.mjs`.

## Pravidlá pre osnovy

- Termíny píš ako **rozpätie viazané na fázu rastliny alebo teplotu**, nikdy
  presný dátum. Slovensko má viac klimatických oblastí a „15. marca" je pre
  Kežmarok aj Štúrovo naraz nesprávne. Fenologický signál („keď kvitne zlatý
  dážď", „keď pôda v 10 cm drží 10 °C") je presnejší než rozpätie dátumov —
  použi ho, keď existuje.
- Žiadny konkrétny prípravok, dávkovanie ani ochranná doba.
- Huby sa nespracúvajú vôbec.
- Bylinky ako rastliny, nie ako liek.
- Žiadna značka výrobku, náradia, hnojiva ani osiva — len druhová kategória
  („dusíkaté hnojivo", nie názov konkrétneho balenia).
- Invázne druhy (nariadenie EÚ 1143/2014) sa neodporúčajú na výsadbu.
- Pri stavovcoch (krt, vtáky, kuny) len odpudzovanie, nikdy usmrcovanie.
- Byliny a plodiny sa pestujú, nie zbierajú z prírody.

---

<!-- ══════════ PREHĽAD MESIACOV — kotva rubriky, jeden na mesiac ══════════ -->

---
slug: co-robit-v-zahrade-januar
obdobie: 12-28 .. 02-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: osevny-plan-na-novu-sezonu, nakup-semien-na-co-si-dat-pozor, izbovky-v-kurenej-miestnosti
---
Bilancia minulej sezóny a nákup semien na tú novú. Izbovky potrebujú v tomto
mesiaci najviac pozornosti — suchý vzduch od kúrenia je väčšie riziko než
samotná zima. V úžitkovej záhrade sa nič nesadí, je čas na papierový osevný
plán. Trávnik a okrasná záhrada odpočívajú.

---
slug: co-robit-v-zahrade-februar
obdobie: 01-25 .. 03-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: rez-jadrovin-jablone-hrusky, rez-ribezli-a-egresov, vysev-priesad-na-okno-paprika-baklazan
---
Ku koncu mesiaca prichádzajú prvé rezy — ríbezle a egreše, jadroviny, keď
dovolí počasie a stromy nie sú zamrznuté. Na okno ide výsev papriky
a baklažánu, majú najdlhšiu vegetáciu spomedzi bežnej zeleniny. Trávnik
a okrasná záhrada ešte spia.

---
slug: co-robit-v-zahrade-marec
obdobie: 02-25 .. 04-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: rez-ruzi, prvy-jarny-vysev-do-pody, travnik-prve-kosenie-a-vertikutacia
---
Najrušnejší mesiac na začiatku sezóny: rez ruží viazaný na rašenie púčikov,
prvý výsev priamo do pôdy (mrkva, hrach, reďkovka), príprava záhonov
a kompostu. Trávnik dostáva prvé kosenie, až keď rastie, nie podľa dátumu.
Mrazy ešte môžu prísť — sledovať predpoveď, nie kalendár.

---
slug: co-robit-v-zahrade-april
obdobie: 03-27 .. 05-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: sadenie-zemiakov, vysadba-kapustovin, ochrana-pred-neskorymi-mrazmi, travnik-hnojenie-a-dosev
---
Sadenie zemiakov a výsadba kapustovín, jarné hnojenie a dosev trávnika.
Okolo polovice mája hrozia ľadoví muži — ešte netreba sadiť teplomilnú
zeleninu von. Trvalky sa dajú deliť, okrasné trávy dostávajú posledný
strih pred novým rastom.

---
slug: co-robit-v-zahrade-maj
obdobie: 04-27 .. 06-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: vysadba-teplomilnych-paradajky-paprika-uhorky, zastipovanie-paradajok, letnicky-a-zavesne-kvetinace
---
Po ľadových mužoch okolo polovice mesiaca ide von teplomilná zelenina —
paradajky, paprika, uhorky. Zaštipovanie paradajok začína čoskoro potom.
Letničky do kvetináčov a záhonov. Trávnik sa kosí pravidelne, nikdy nie
o viac než tretinu výšky naraz.

---
slug: co-robit-v-zahrade-jun
obdobie: 05-27 .. 07-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: zalievanie-kedy-a-kolko, letny-rez-ovocnych-drevin, zber-jahod-a-starostlivost-po-nom
---
Zálievka sa stáva hlavnou pravidelnou prácou — radšej menej často
a výdatne. Kôstkoviny (čerešňa, slivka, marhuľa) dostávajú letný rez,
nie zimný. Zbiera sa prvá jahoda. Živý plot čaká hlavný strih.

---
slug: co-robit-v-zahrade-jul
obdobie: 06-27 .. 08-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: zalievanie-pocas-horucav, zber-cesnaku-a-cibule, mnozenie-odrezkami
---
Horúčavy testujú zálievkový režim — hlboko a zriedkavo, nie denne po
troche. Zberá sa cesnak a cibuľa, keď vňať ľahne. Množenie odrezkami má
v tomto období najvyššiu úspešnosť. Trávnik v suchu radšej necháva
odpočívať, než ho hnojiť.

---
slug: co-robit-v-zahrade-august
obdobie: 07-27 .. 09-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: zber-jablk-a-hrusiek, vysadba-jahod, spracovanie-urody-zaklady
---
Začína zber jabĺk a hrušiek podľa zberovej zrelosti, nie podľa dátumu.
Vysádzajú sa jahody — koniec leta je na to lepší termín než jar. Prvá
úroda čaká na spracovanie alebo skladovanie. Trávnik sa pripravuje na
najlepší termín zásahu, ktorý prichádza už čoskoro.

---
slug: co-robit-v-zahrade-september
obdobie: 08-27 .. 10-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: travnik-regeneracia-po-lete, sadenie-cesnaku, izbovky-presun-dnu
---
Najlepší mesiac na zásah do trávnika — regenerácia, dosev, hnojenie,
tráva teraz zakoreňuje najlepšie za celý rok. Sadí sa cesnak na budúcu
sezónu. Izbovky sa presúvajú z balkóna dnu podľa nočných teplôt, nie
podľa dátumu.

---
slug: co-robit-v-zahrade-oktober
obdobie: 09-27 .. 11-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: vysadba-ovocnych-drevin, vysadba-cibulovin-tulipany-narcisy, listie-a-kompost-na-jesen
---
Výsadba ovocných drevín a cibuľovín (tulipány, narcisy) — jeseň je na
oboje lepšia než jar. Zberá a skladuje sa koreňová zelenina. Lístie sa
buď kompostuje, alebo ostáva pod krami ako prirodzená ochrana, nikdy
nie na trávniku.

---
slug: co-robit-v-zahrade-november
obdobie: 10-27 .. 12-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: zazimovanie-zahrady, ochrana-kmenov-pred-zimou, travnik-posledne-kosenie
---
Zazimovanie záhrady — poradie prác pred prvými silnými mrazmi. Ochrana
kmeňov pred popraskaním kôry a citlivých rastlín pred mrazom. Trávnik
dostáva posledné kosenie, viazané na rast, nie na dátum.

---
slug: co-robit-v-zahrade-december
obdobie: 11-27 .. 01-02
oblast: prehlad
priorita: 1
typ: prehlad
suvisi: vianocne-rastliny-starostlivost, kontrola-skladovanej-urody, planovanie-novych-zahonov
---
Záhrada spí, izbovky a vianočné rastliny (vianočná hviezda, amarylis)
potrebujú najviac starostlivosti za celý rok. Skladovaná úroda sa
pravidelne prehliada kvôli hnilobe. Zima je čas na papierové plánovanie
nových záhonov.


<!-- ══════════ ZIMA: plánovanie, izbovky, rez ══════════ -->

---
slug: osevny-plan-na-novu-sezonu
obdobie: 01-02 .. 02-20
oblast: uzitkova
priorita: 1
typ: ako
suvisi: nakup-semien-na-co-si-dat-pozor, bilancia-sezony-zapisnik
---
Ako si rozvrhnúť záhon na celý rok. Striedanie plodín a prečo sa paradajky
nesadia dva roky po sebe na to isté miesto. Čo po čom nasleduje dobre a čo zle.
Papierový plán ušetrí polovicu problémov v lete.

---
slug: nakup-semien-na-co-si-dat-pozor
obdobie: 01-05 .. 03-10
oblast: uzitkova
priorita: 2
typ: ako
suvisi: osevny-plan-na-novu-sezonu, vysev-priesad-na-okno-paprika-baklazan
---
Klíčivosť a dátum na obale. Rozdiel medzi odrodou a hybridom F1 — čo to
znamená pre zber vlastných semien. Koľko semien reálne treba, aby človek
nekupoval na tri roky dopredu.

---
slug: izbovky-v-zime-preco-hynu
obdobie: 11-15 .. 02-28
oblast: izbovky
priorita: 1
typ: preco
suvisi: svetlo-pre-izbovky-v-zime, izbovky-v-kurenej-miestnosti
---
Najčastejšia príčina úhynu v zime nie je zima, ale **prelievanie a suchý
vzduch od kúrenia**. Prečo rastlina v tme potrebuje menej vody. Vzdialenosť od
radiátora a od studeného skla. Ako spoznať prelievanie od presušenia.

---
slug: svetlo-pre-izbovky-v-zime
obdobie: 11-20 .. 02-15
oblast: izbovky
priorita: 2
typ: preco
suvisi: izbovky-v-zime-preco-hynu
---
Prečo rastliny v zime vyťahujú a blednú. Kam ich presunúť. Kedy má zmysel
prisvetľovať a kedy je to zbytočné. Otáčanie kvetináča.

---
slug: rez-jadrovin-jablone-hrusky
obdobie: 01-20 .. 03-25
oblast: uzitkova
priorita: 1
typ: kedy
suvisi: rez-ribezli-a-egresov, letny-rez-ovocnych-drevin
---
Kedy je bezpečné strihať — viazať na **bezmrazé počasie**, nie na dátum.
Rozdiel medzi výchovným a udržiavacím rezom. Čo je konkurenčný výhonok
a prečo sa odstraňuje. Ošetrenie väčších rán.

---
slug: rez-ribezli-a-egresov
obdobie: 02-01 .. 03-20
oblast: uzitkova
priorita: 1
typ: ako
suvisi: rez-jadrovin-jablone-hrusky
---
Ríbezle plodia na inom dreve než egreše — preto sa strihajú inak. Ktoré
výhonky preč a prečo. Omladzovanie starého kríka.

---
slug: vysev-priesad-na-okno-paprika-baklazan
obdobie: 02-05 .. 03-15
oblast: uzitkova
priorita: 1
typ: kedy
suvisi: vysev-paradajok-na-priesady, nakup-semien-na-co-si-dat-pozor
---
Prečo idú paprika a baklažán na výsev najskôr — majú najdlhšiu vegetáciu.
Teplota klíčenia, hĺbka, substrát. Prečo priesada bez dosvetlenia vyťahuje
a čo s tým.

---
slug: presadzovanie-izboviek-jar
obdobie: 02-20 .. 04-30
oblast: izbovky
priorita: 1
typ: ako
suvisi: izbovky-zaciatok-hnojenia
---
Ako spoznať, že kvetináč je malý. O koľko väčší ďalší — a prečo „na zásobu"
škodí. Substrát, drenáž, čo s koreňovým balom. Kedy sa presádzať nemá.

---
slug: travnik-v-zime-co-nerobit
obdobie: 12-01 .. 02-28
oblast: travnik
priorita: 3
typ: preco
suvisi: travnik-prve-kosenie-a-vertikutacia
---
Chodenie po zamrznutom alebo premočenom trávniku poškodí steblá aj pôdu.
Prečo sa v zime nehnojí. Lístie, ktoré ostalo — kedy vadí.


<!-- ══════════ PREDJARIE ══════════ -->

---
slug: rez-ruzi
obdobie: 03-01 .. 04-10
oblast: okrasna
priorita: 1
typ: kedy
suvisi: delenie-trvaliek, hnojenie-okrasnych-drevin-a-krikov, zivy-plot-kedy-strihat
---
Termín viazať na **rašenie púčikov**, nie na dátum. Rozdiel medzi záhonovou,
popínavou a kríkovou ružou. Nad ktorý púčik strihať a v akom uhle.

---
slug: vysev-paradajok-na-priesady
obdobie: 03-01 .. 04-05
oblast: uzitkova
priorita: 1
typ: kedy
suvisi: vysadba-teplomilnych-paradajky-paprika-uhorky, zastipovanie-paradajok
---
Kedy vysiať, aby priesada nebola prerastená — počítať späť od výsadby von.
Pikírovanie. Prečo sa priesada otužuje a ako.

---
slug: prvy-jarny-vysev-do-pody
obdobie: 03-05 .. 04-15
oblast: uzitkova
priorita: 1
typ: kedy
suvisi: priprava-zahonov-a-kompost
---
Čo znesie chlad: mrkva, hrach, špenát, reďkovka, cibuľa. Termín viazať na
**teplotu pôdy**, nie kalendár — pôda musí byť zrelá, nie blatistá. Test
hrsťou zeminy.

---
slug: priprava-zahonov-a-kompost
obdobie: 03-10 .. 04-20
oblast: uzitkova
priorita: 2
typ: ako
suvisi: listie-a-kompost-na-jesen
---
Čo s pôdou po zime. Prečo hlboké rytie nie je vždy dobrý nápad. Ako spoznať
hotový kompost a koľko ho dať.

---
slug: travnik-prve-kosenie-a-vertikutacia
obdobie: 03-15 .. 04-25
oblast: travnik
priorita: 1
typ: kedy
suvisi: travnik-v-zime-co-nerobit, travnik-vyska-kosenia, travnik-machorast-a-priciny
---
Prvé kosenie až keď tráva rastie, nie podľa dátumu. Výška prvého kosenia.
Čo je plsť a kedy má vertikutácia zmysel — a kedy trávnik zbytočne zničí.

---
slug: delenie-trvaliek
obdobie: 03-20 .. 04-30
oblast: okrasna
priorita: 2
typ: kedy
suvisi: rez-ruzi, sadenie-trvaliek-na-jar
---
Ktoré trvalky sa delia na jar a ktoré na jeseň. Ako spoznať, že trs treba
rozdeliť. Postup, aby to rastlina prežila.

---
slug: strihanie-okrasnych-tráv-a-trvaliek
obdobie: 03-01 .. 04-10
oblast: okrasna
priorita: 2
typ: kedy
suvisi: rez-ruzi, delenie-trvaliek
---
Prečo sa okrasné trávy nechávajú cez zimu neostrihané a kedy ich odstrihnúť.
Ako vysoko. Čo s trvalkami, ktoré prezimovali so suchou vňaťou.

---
slug: hnojenie-okrasnych-drevin-a-krikov
obdobie: 03-15 .. 04-30
oblast: okrasna
priorita: 2
typ: kedy
suvisi: rez-ruzi
---
Kedy a čím hnojiť kvitnúce kry. Prečo prehnojenie dusíkom škodí kvitnutiu —
rastie list, nie kvet. Rozdiel medzi jarným a letným hnojivom pre kry.

---
slug: travnik-machorast-a-priciny
obdobie: 03-01 .. 05-31
oblast: travnik
priorita: 2
typ: preco
suvisi: travnik-prve-kosenie-a-vertikutacia, travnik-v-zime-co-nerobit
---
Mach v trávniku nie je problém sám osebe, je **príznak** — tieň, kyslá pôda,
zlá priepustnosť, nízke kosenie. Prečo len vyhrabať mach bez riešenia
príčiny pomôže len na pár týždňov.

---
slug: okrasny-travnik-vs-uzitkovy-rozdiely
obdobie: 03-01 .. 05-31
oblast: travnik
priorita: 3
typ: preco
suvisi: zalozenie-noveho-travnika-osevom
---
Prečo sa parkový trávnik a záťažový (rodinný, so psom a deťmi) trávnik sejú
iným osivom. Prečo kopírovanie „golfového" trávnika na plochu, ktorú rodina
denne používa, väčšinou sklame.


<!-- ══════════ JAR ══════════ -->

---
slug: sadenie-zemiakov
obdobie: 04-01 .. 05-10
oblast: uzitkova
priorita: 1
typ: ako
suvisi: ochrana-pred-neskorymi-mrazmi
---
Predklíčenie a prečo sa oplatí. Hĺbka, spon, teplota pôdy. Prihŕňanie — kedy
a načo.

---
slug: vysadba-kapustovin
obdobie: 04-05 .. 05-20
oblast: uzitkova
priorita: 2
typ: ako
suvisi: sadenie-zemiakov
---
Kapusta, karfiol, brokolica, kaleráb. Spon, hĺbka výsadby, zálievka po
výsadbe. Prečo kapustoviny potrebujú viac miesta, než sa zdá.

---
slug: ochrana-pred-neskorymi-mrazmi
obdobie: 04-10 .. 05-25
oblast: uzitkova
priorita: 1
typ: ako
suvisi: sadenie-zemiakov, vysadba-teplomilnych-paradajky-paprika-uhorky
zdroje: shmu
---
Ľadoví muži okolo polovice mája a prečo to nie je povera. Ako zakryť
priesady. Rozdiel medzi prízemným mrazom a mrazom vo výške. Čo robiť ráno po
mraze — a čo nerobiť.

---
slug: travnik-hnojenie-a-dosev
obdobie: 04-01 .. 05-15
oblast: travnik
priorita: 1
typ: kedy
suvisi: travnik-jesenne-hnojenie, zalozenie-noveho-travnika-osevom
---
Kedy má jarné hnojenie zmysel. Dosev holých miest — príprava, zálievka,
trpezlivosť. Prečo sa dosiate miesto nesmie nechať vyschnúť.

---
slug: izbovky-zaciatok-hnojenia
obdobie: 03-15 .. 05-15
oblast: izbovky
priorita: 2
typ: kedy
suvisi: presadzovanie-izboviek-jar
---
Prečo sa v zime nehnojí a kedy začať. Ako spoznať, že rastlina rastie.
Prehnojenie a jeho príznaky.

---
slug: bylinkova-spiralka-a-zaklady
obdobie: 04-10 .. 06-15
oblast: uzitkova
priorita: 3
typ: ako
suvisi: izbovky-na-balkone-v-lete, zelenina-v-kvetinacoch-na-balkone
---
Ktoré bylinky znesú sucho a ktoré chcú vlhko. Prečo nepatria všetky do
jedného kvetináča. Bylinky sa opisujú **ako rastliny**, nie ako liek.

---
slug: vysadba-teplomilnych-paradajky-paprika-uhorky
obdobie: 05-10 .. 06-10
oblast: uzitkova
priorita: 1
typ: kedy
suvisi: vysev-paradajok-na-priesady, ochrana-pred-neskorymi-mrazmi
---
Až po ustálení nočných teplôt. Spon, hĺbka (paradajka znesie hlbšiu výsadbu),
opora hneď pri výsadbe. Prečo sa nesadí do studenej pôdy.

---
slug: zastipovanie-paradajok
obdobie: 05-20 .. 08-15
oblast: uzitkova
priorita: 1
typ: ako
suvisi: vysadba-teplomilnych-paradajky-paprika-uhorky
---
Čo je zálistok a prečo sa odstraňuje. Rozdiel medzi kolíkovou a kríčkovou
odrodou — pri kríčkovej sa nezaštipuje. Kedy zaštipnúť vrchol.

---
slug: letnicky-a-zavesne-kvetinace
obdobie: 05-05 .. 06-20
oblast: okrasna
priorita: 2
typ: ako
suvisi: bylinkova-spiralka-a-zaklady
---
Čo znesie plné slnko a čo tieň. Prečo závesný kvetináč vysychá rýchlejšie.
Odstraňovanie odkvitnutých kvetov a prečo predlžuje kvitnutie.

---
slug: travnik-vyska-kosenia
obdobie: 05-01 .. 09-15
oblast: travnik
priorita: 1
typ: ako
suvisi: travnik-prve-kosenie-a-vertikutacia
---
Pravidlo tretiny — nikdy neodobrať viac než tretinu výšky. Prečo nízko
kosený trávnik v lete zhorí. Mulčovanie verzus zber.

---
slug: sadenie-trvaliek-na-jar
obdobie: 04-01 .. 05-20
oblast: okrasna
priorita: 2
typ: kedy
suvisi: delenie-trvaliek
---
Kedy je pôda dosť teplá na výsadbu nových trvaliek. Zálievka po výsadbe
prvé týždne, kým koreň nezachytí. Rozostupy podľa dospelej veľkosti
rastliny, nie podľa toho, aká malá je sadenica teraz.

---
slug: zalozenie-noveho-travnika-osevom
obdobie: 04-01 .. 05-15
oblast: travnik
priorita: 2
typ: ako
suvisi: travnik-hnojenie-a-dosev, okrasny-travnik-vs-uzitkovy-rozdiely
---
Príprava pôdy pred sejbou, výber osiva podľa slnka alebo tieňa plochy,
množstvo semena na meter štvorcový. Prvé kosenie až pri výške 8-10 cm,
nie skôr.


<!-- ══════════ LETO ══════════ -->

---
slug: izbovky-na-balkone-v-lete
obdobie: 05-15 .. 07-10
oblast: izbovky
priorita: 2
typ: ako
suvisi: izbovky-presun-dnu
---
Ktoré izbovky letu vonku prospejú a ktoré nie. Prečo sa nesmú vyložiť rovno
na plné slnko — spálené listy sú do dvoch dní. Postupné otužovanie, ochrana
pred vetrom a prudkým dažďom. Pár s témou `izbovky-presun-dnu` na jeseň.

---
slug: zalievanie-kedy-a-kolko
obdobie: 05-20 .. 09-10
oblast: uzitkova
priorita: 1
typ: kedy
suvisi: zalievanie-pocas-horucav, mulcovanie
---
Radšej menej často a výdatne než denne po troche — plytká zálievka vychová
plytké korene. Ráno verzus večer. Ako zistiť, či je pôda vlhká hlbšie.

---
slug: mulcovanie
obdobie: 05-15 .. 07-31
oblast: uzitkova
priorita: 2
typ: ako
suvisi: zalievanie-kedy-a-kolko
---
Čím mulčovať a čím nie. Koľko treba, aby to fungovalo. Prečo mulč šetrí vodu
aj plytie. Kde mulč naopak škodí.

---
slug: skodcovia-v-zahrade-ako-postupovat
obdobie: 05-15 .. 08-31
oblast: uzitkova
priorita: 1
typ: ako
suvisi: choroby-rastlin-prevencia, skodcovia-na-okrasnych-rastlinach
zdroje: uksup
---
Postup od najmiernejšieho zásahu: mechanické odstránenie, podpora
prirodzených nepriateľov, až potom chemická ochrana. **Bez konkrétnych
prípravkov a dávok** — odkázať na registrované prípravky a text etikety.
Bez obrázkov škodcov generovaných AI.

---
slug: choroby-rastlin-prevencia
obdobie: 05-20 .. 08-31
oblast: uzitkova
priorita: 2
typ: ako
suvisi: skodcovia-v-zahrade-ako-postupovat
zdroje: uksup
---
Prečo je vzdušnosť a zálievka ku koreňom dôležitejšia než postrek. Striedanie
plodín ako prevencia. Čo s napadnutými zvyškami — a prečo nepatria do
kompostu.

---
slug: letny-rez-ovocnych-drevin
obdobie: 06-15 .. 08-15
oblast: uzitkova
priorita: 2
typ: preco
suvisi: rez-jadrovin-jablone-hrusky, rez-ribezli-a-egresov
---
Prečo sa niektoré dreviny strihajú v lete a nie v zime. Kôstkoviny —
čerešňa, slivka, marhuľa — a riziko klejotoku pri zimnom reze.

---
slug: zber-jahod-a-starostlivost-po-nom
obdobie: 06-01 .. 07-15
oblast: uzitkova
priorita: 2
typ: kedy
suvisi: vysadba-jahod
---
Kedy je jahoda zrelá. Čo robiť po zbere — odstránenie starých listov,
zakoreňovanie odnoží. Prečo sa záhon po troch rokoch obnovuje.

---
slug: zalievanie-pocas-horucav
obdobie: 06-20 .. 08-31
oblast: uzitkova
priorita: 1
typ: ako
suvisi: zalievanie-kedy-a-kolko, travnik-v-suchu
---
Čo robiť pri dlhom suchu. Prečo sa nezalieva na list za slnka. Tieňovanie.
Ktoré rastliny vydržia a ktoré treba zachraňovať prednostne.

---
slug: letny-vysev-na-jesenny-zber
obdobie: 06-25 .. 08-10
oblast: uzitkova
priorita: 2
typ: kedy
suvisi: prvy-jarny-vysev-do-pody
---
Druhá vlna: šalát, kaleráb, mrkva na zimu, fazuľa. Prečo sa v lete vysieva
hlbšie a viac zalieva. Uvoľnené miesto po skorých plodinách.

---
slug: zber-cesnaku-a-cibule
obdobie: 06-25 .. 08-15
oblast: uzitkova
priorita: 2
typ: kedy
suvisi: sadenie-cesnaku
---
Ako spoznať zrelosť podľa vňate. Sušenie a skladovanie. Prečo sa nezberá
mokré.

---
slug: travnik-v-suchu
obdobie: 06-15 .. 08-31
oblast: travnik
priorita: 1
typ: preco
suvisi: zalievanie-pocas-horucav, zavlazovanie-travnika-automaticky-system
---
Zožltnutý trávnik väčšinou nie je mŕtvy. Kosiť vyššie, zalievať výdatne
a zriedka, alebo nechať odpočívať. Prečo sa v suchu nehnojí.

---
slug: izbovky-cez-dovolenku
obdobie: 06-20 .. 08-20
oblast: izbovky
priorita: 2
typ: ako
suvisi: izbovky-na-balkone-v-lete
---
Ako zabezpečiť rastliny na dva týždne. Presun z okna, zoskupenie, knôtová
zálievka. Čo naozaj funguje a čo je mýtus.

---
slug: skodcovia-na-okrasnych-rastlinach
obdobie: 05-01 .. 08-31
oblast: okrasna
priorita: 2
typ: ako
suvisi: skodcovia-v-zahrade-ako-postupovat
zdroje: uksup
---
Mšice, molice, pavúčiky na okrasných rastlinách a kroch — mechanický zásah
ako prvý krok (oplach, obmedzenie premnoženia), chemická ochrana až keď
nestačí. Bez konkrétnych prípravkov, odkaz na register ÚKSÚP.

---
slug: zivy-plot-kedy-strihat
obdobie: 06-01 .. 07-15
oblast: okrasna
priorita: 2
typ: kedy
suvisi: rez-ruzi
---
Živý plot sa strihá cez rok viackrát, hlavný rez prichádza v lete. Prečo
skorý jarný rez oberie plot o hniezdiace vtáky — praktická aj ohľaduplná
poznámka, nie len estetická.

---
slug: zavlazovanie-travnika-automaticky-system
obdobie: 04-15 .. 08-31
oblast: travnik
priorita: 3
typ: ako
suvisi: travnik-v-suchu, zalievanie-kedy-a-kolko
---
Kedy sa oplatí automatický systém a kedy stačí obyčajná hadica. Ranné
zavlažovanie pred ôsmou je lepšie než večerné. Prečo časté plytké
zavlažovanie škodí trávniku viac než žiadne.


<!-- ══════════ NESKORÉ LETO ══════════ -->

---
slug: mnozenie-odrezkami
obdobie: 07-15 .. 09-15
oblast: okrasna
priorita: 2
typ: ako
suvisi: delenie-trvaliek
---
Ktoré rastliny sa množia odrezkom a kedy je najlepší čas. Voda verzus
substrát. Prečo väčšina odrezkov zhnije skôr, než zakorení.

---
slug: vysadba-jahod
obdobie: 08-01 .. 09-20
oblast: uzitkova
priorita: 2
typ: preco
suvisi: zber-jahod-a-starostlivost-po-nom
---
Prečo je koniec leta lepší než jar. Spon, hĺbka srdiečka — príliš hlboko
znamená hnilobu. Príprava záhonu.

---
slug: travnik-regeneracia-po-lete
obdobie: 08-15 .. 09-30
oblast: travnik
priorita: 1
typ: preco
suvisi: travnik-jesenne-hnojenie, travnik-vertikutacia-vs-prevzdusnenie
---
Najlepší čas na zásah do trávnika je koniec leta, nie jar. Dosev,
prevzdušnenie, hnojenie. Prečo tráva v tomto období zakoreňuje najlepšie.

---
slug: spracovanie-urody-zaklady
obdobie: 08-01 .. 10-15
oblast: uzitkova
priorita: 2
typ: ako
suvisi: zber-a-skladovanie-korenovej-zeleniny, kontrola-skladovanej-urody
---
Čo znesie skladovanie a čo treba spracovať hneď. Podmienky v pivnici.
Základné princípy — bez konkrétnych receptov na zaváranie a bez tvrdení
o trvanlivosti.

---
slug: travnik-vertikutacia-vs-prevzdusnenie
obdobie: 08-15 .. 09-30
oblast: travnik
priorita: 2
typ: preco
suvisi: travnik-prve-kosenie-a-vertikutacia, travnik-regeneracia-po-lete
---
Rozdiel medzi vertikutáciou a prevzdušnením — iný nástroj, iný účel, iný
zásah do trávnika. Kedy stačí jedno a kedy oboje naraz.


<!-- ══════════ JESEŇ ══════════ -->

---
slug: zber-jablk-a-hrusiek
obdobie: 08-20 .. 10-31
oblast: uzitkova
priorita: 1
typ: kedy
suvisi: rez-jadrovin-jablone-hrusky
---
Ako spoznať zberovú zrelosť — a prečo je iná než konzumná. Skúška
otočením. Ktoré odrody sa skladujú a ktoré treba zjesť hneď.

---
slug: sadenie-cesnaku
obdobie: 09-20 .. 11-10
oblast: uzitkova
priorita: 1
typ: preco
suvisi: zber-cesnaku-a-cibule
---
Jesenný cesnak dáva väčšie hlavy než jarný. Hĺbka, spon, orientácia
strúčika. Prečo sa nesadí kupovaný konzumný cesnak.

---
slug: vysadba-cibulovin-tulipany-narcisy
obdobie: 09-15 .. 11-15
oblast: okrasna
priorita: 1
typ: kedy
suvisi: planovanie-novych-zahonov, jesenna-vysadba-okrasnych-drevin
---
Termín viazať na **teplotu pôdy**, nie dátum. Hĺbka podľa veľkosti cibule.
Čo sa deje, keď sa vysadí príliš skoro. Ochrana pred hlodavcami.

---
slug: travnik-jesenne-hnojenie
obdobie: 09-10 .. 10-31
oblast: travnik
priorita: 2
typ: preco
suvisi: travnik-hnojenie-a-dosev, travnik-regeneracia-po-lete
---
Prečo je jesenné hnojivo iné než jarné. Posledné kosenie a jeho výška. Lístie
na trávniku — kedy vadí a kedy nie.

---
slug: izbovky-presun-dnu
obdobie: 09-01 .. 10-20
oblast: izbovky
priorita: 1
typ: kedy
suvisi: izbovky-na-balkone-v-lete, muskaty-a-balkonovky-pred-mrazom
---
Kedy presunúť rastliny z balkóna dnu — viazať na nočné teploty. Kontrola
škodcov pred presunom. Postupné privykanie na nižšie svetlo.

---
slug: vysadba-ovocnych-drevin
obdobie: 10-01 .. 11-25
oblast: uzitkova
priorita: 1
typ: preco
suvisi: rez-jadrovin-jablone-hrusky, jesenna-vysadba-okrasnych-drevin
---
Jeseň je na výsadbu lepšia než jar — drevina zakorení do mrazov. Veľkosť
jamy, hĺbka krčka, opora, zálievka. Najčastejšia chyba: príliš hlboká výsadba.

---
slug: zber-a-skladovanie-korenovej-zeleniny
obdobie: 09-25 .. 11-10
oblast: uzitkova
priorita: 2
typ: kedy
suvisi: spracovanie-urody-zaklady
---
Mrkva, petržlen, zeler, repa. Kedy vybrať, ako orezať vňať. Podmienky
skladovania — teplota, vlhkosť, piesok.

---
slug: listie-a-kompost-na-jesen
obdobie: 10-05 .. 11-30
oblast: uzitkova
priorita: 2
typ: ako
suvisi: priprava-zahonov-a-kompost
---
Čo s lístím. Prečo nie všetko patrí na kompost. Zakladanie kompostu na jeseň
a pomer materiálov.

---
slug: jesenna-vysadba-okrasnych-drevin
obdobie: 09-15 .. 11-15
oblast: okrasna
priorita: 2
typ: preco
suvisi: vysadba-ovocnych-drevin, vysadba-cibulovin-tulipany-narcisy
---
Prečo je jeseň na výsadbu kríkov a okrasných stromčekov lepšia než jar —
koreň zakoreňuje do zimy bez záťaže olistenej koruny.

---
slug: muskaty-a-balkonovky-pred-mrazom
obdobie: 09-20 .. 10-25
oblast: izbovky
priorita: 2
typ: kedy
suvisi: izbovky-presun-dnu
---
Ktoré balkónové kvety prvý mráz nezničí a ktoré treba zachrániť skôr.
Muškáty prezimujú aj v tme a chlade — nepotrebujú svetlo, potrebujú chlad
okolo 10 °C. Rezanie a úprava pred presunom.


<!-- ══════════ PRÍPRAVA NA ZIMU ══════════ -->

---
slug: zazimovanie-zahrady
obdobie: 10-20 .. 12-05
oblast: uzitkova
priorita: 1
typ: ako
suvisi: ochrana-kmenov-pred-zimou
---
Poradie prác pred prvými mrazmi. Čo sa musí zberať a čo znesie mráz. Voda
v hadiciach a sudoch. Náradie.

---
slug: ochrana-kmenov-pred-zimou
obdobie: 11-01 .. 12-20
oblast: uzitkova
priorita: 2
typ: preco
suvisi: zazimovanie-zahrady
---
Prečo praská kôra na južnej strane kmeňa. Bielenie a ovinutie. Ochrana pred
obhryzom zverou.

---
slug: ochrana-citlivych-rastlin
obdobie: 10-25 .. 12-10
oblast: okrasna
priorita: 2
typ: ako
suvisi: izbovky-presun-dnu
---
Ktoré rastliny potrebujú kryt a ktoré si uškodíme zabalením. Materiály.
Prečo je vlhko pod krytom nebezpečnejšie než mráz.

---
slug: travnik-posledne-kosenie
obdobie: 10-15 .. 11-25
oblast: travnik
priorita: 2
typ: kedy
suvisi: travnik-jesenne-hnojenie
---
Kedy prestať kosiť — viazať na rast, nie dátum. Výška do zimy a prečo
nie príliš nízko ani vysoko.


<!-- ══════════ ZIMA: sviatky a bilancia ══════════ -->

---
slug: vianocne-rastliny-starostlivost
obdobie: 11-25 .. 01-10
oblast: izbovky
priorita: 1
typ: preco
suvisi: izbovky-v-kurenej-miestnosti
---
Vianočná hviezda, amarylis, hyacint. Prečo vianočná hviezda hynie do troch
týždňov — prievan pri prenose a prelievanie. Čo s ňou po sviatkoch.

---
slug: izbovky-v-kurenej-miestnosti
obdobie: 12-01 .. 02-20
oblast: izbovky
priorita: 2
typ: ako
suvisi: izbovky-v-zime-preco-hynu, vianocne-rastliny-starostlivost
---
Suchý vzduch a ako ho reálne zvýšiť — čo funguje a čo je mýtus (rosenie).
Prach na listoch. Prečo rastlina v zime nepotrebuje viac tepla, ale viac
svetla.

---
slug: bilancia-sezony-zapisnik
obdobie: 11-20 .. 01-31
oblast: uzitkova
priorita: 3
typ: ako
suvisi: osevny-plan-na-novu-sezonu
---
Čo si zapísať, kým je to v pamäti: ktorá odroda sa osvedčila, kde bolo mokro,
čo vyšlo a čo nie. Podklad pre osevný plán na ďalší rok.

---
slug: kontrola-skladovanej-urody
obdobie: 12-01 .. 03-15
oblast: uzitkova
priorita: 3
typ: preco
suvisi: spracovanie-urody-zaklady
---
Prečo treba zásoby pravidelne prehliadať. Ako spoznať začínajúcu hnilobu.
Vetranie pivnice.

---
slug: planovanie-novych-zahonov
obdobie: 12-10 .. 02-28
oblast: okrasna
priorita: 3
typ: ako
suvisi: vysadba-cibulovin-tulipany-narcisy
---
Zima je na papierové plánovanie. Slnko a tieň počas roka. Prečo sa nový
záhon kreslí skôr, než sa kope.

---
slug: naradie-udrzba-a-ostrenie
obdobie: 11-15 .. 02-28
oblast: uzitkova
priorita: 3
typ: ako
suvisi: rez-jadrovin-jablone-hrusky
---
Čistenie, ostrenie, konzervácia. Prečo tupé nožnice poškodia drevinu viac než
neskorý rez. Dezinfekcia medzi stromami.

---
slug: zelenina-v-kvetinacoch-na-balkone
obdobie: 04-10 .. 06-10
oblast: uzitkova
priorita: 2
typ: ako
suvisi: bylinkova-spiralka-a-zaklady, zalievanie-kedy-a-kolko
---
Čo rastie v kvetináči dobre a čo nie. Veľkosť nádoby podľa druhu — paradajka
potrebuje aspoň 10 litrov substrátu, bylinke stačí menej. Substrát iný než
záhradná zem. Zálievka v nádobe je náročnejšia, vysychá rýchlejšie než
v záhone.
