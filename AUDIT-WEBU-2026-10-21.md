# Novinko — audit webu a odporúčané poradie úprav

Dátum: 21. 10. 2026. Zadanie: nadčasový spravodajský web z pohľadu dizajnu,
použiteľnosti, dôvery a návratu čitateľa. Tento dokument je návrh ďalšej práce.

## Čo bolo overené

Živý web v Chrome: úvod na šírkach 1440 a 390 px, Krypto na 390 px, Ekonomika
na 1440 px, detail aktuálneho článku o etherových ETF na oboch šírkach,
vyhľadávanie cez `/archiv?q=zzznothing987654321` a Záhrada na 390 px.
Porovnanie s lokálnymi šablónami, načítaním obsahu a výberom hlavného článku.
Snímky a výstupy sú v `/tmp/novinko-design-audit/`; sú dočasné.

Na kontrolovaných stránkach sa dokument vodorovne neroztekal a prehliadač
nezachytil JavaScript výnimku. Je to kontrola konkrétnej vzorky, nie úplný audit
prístupnosti alebo výkonu. Dáta z GA4 a Search Console neboli k dispozícii.
Závery o vplyve na správanie čitateľov sú hypotézy na následné meranie.

Predchádzajúca lokálna úprava jednotných dátumov ešte pri tejto kontrole nebola
viditeľná na produkcii. Rozdielne dátumy na snímkach preto nepredstavujú novú
chybu v tejto pripravenej úprave.

## Smer značky

Zachovať výrazné logo, serifové titulky, svetlý podklad a striedmy akcent.
Tieto prvky už vytvárajú použiteľný základ spravodajskej identity.

Odporúčaný čitateľský prísľub: **Dôležité správy. Zrozumiteľné súvislosti.**
Je to návrh textu na overenie. Oznámenie o používaní AI má zostať dostupné
a zrozumiteľné. Vedľa prísľubu treba vysvetliť, ako prebieha ľudská kontrola.

Hlavná stránka má reprezentovať redakčné priority celého portálu. Magazínové
rubriky môžu mať vlastnú atmosféru, ale čitateľ musí všade rozumieť navigácii,
odkazom, dátumom, zdrojom a spôsobu návratu na úvod.

## Potvrdené problémy

| Nález | Dôkaz | Odporúčanie |
|---|---|---|
| Vyhľadávanie z hlavičky nefiltruje výsledky. | Nezmyselný dotaz na `/archiv?q=...` vrátil všetkých 1 619 článkov. Handler v `netlify/functions/archiv.js` dotaz nečíta. | Skutočné hľadanie, zobrazenie dotazu, počet výsledkov, prázdny stav a stránkovanie. Zachovať dostupný indexovateľný archív. |
| Hlavný článok nevyberá zo všetkých hlavných rubrík. | `LEAD_SECTIONS` obsahuje iba Krypto, AI a Slovensko; `pickLead()` uprednostní vlastný článok s obrázkom. | Redakčný výber s možnosťou pripnúť článok do stanoveného času; náhradný výber zo všetkých spravodajských rubrík. |
| Mobilné Krypto odsúva titulok prvého článku pod prvú obrazovku. | Snímka 390 × 844 px: hlavička, navigácia, trhový pás, úvod rubriky, záložky a obrázok pred titulkom. | Kompaktnejší úvod, titulok pred obrázkom, trhové údaje s menšou prioritou v pohľade Správy. |
| AI obrázok má nepresný popis. | V kontrolovanom článku je „Foto: AI ilustrácia“. Funkcia `popisObrazka()` pridáva „Foto:“ k bežnému kreditu. | Jasne rozlišovať fotografiu, ilustráciu a AI ilustráciu vo všetkých publikačných cestách. |
| „Aktualizované“ môže vyvolať nesprávny dojem čerstvosti obsahu. | `stampUpdate()` vypisuje aktuálny čas po načítaní dát. Ekonomika tak mala čerstvý čas v hlavičke, ale prvý článok z 19. októbra. | Označiť „Prehľad obnovený“ alebo uviesť skutočný čas poslednej publikácie podľa významu konkrétneho údaja. |
| Detail článku používa inú hlavičku a menšiu množinu rubrík. | Rozdiel medzi úvodom a kontrolovaným detailom. | Zjednotiť navigačné správanie a dostupnosť rubrík, pri článku použiť kompaktnú verziu spoločnej hlavičky. |
| Pokračovanie po článku je prevažne chronologické. | Pod ETF článkom boli aj správy o AI a počasí; `clanok.js` okrem vybraných rubrík vyberá naprieč webom. | Prednostne ponúknuť relevantný článok k téme a vysvetlenie pojmu; ďalšie správy môžu nasledovať za nimi. |

## Návrh používateľského zážitku

### Úvod

Poradie obsahu: kompaktná hlavička a rubriky → hlavná udalosť a tri dôležité
správy → krátky výber toho podstatného → spravodajské rubriky → magazínový
obsah → možnosť pravidelného odberu → pätička.

Výber „To podstatné“ musí priniesť redakčnú hodnotu a obmedziť opakovanie
rovnakých titulkov. Pri malom počte nových článkov radšej kratší prehľad.
Rozlišovať najnovšie správy, redakčný výber a skutočne meranú čítanosť.

Na mobile pridať jasný vstup „Rubriky“ k existujúcej posuvnej navigácii.
Aktívna rubrika má byť viditeľná aj pri priamom otvorení odkazu.

### Detail článku

Odporúčané poradie: rubrika, autor a dátum → titulok → stručný perex → vhodný
vizuál → text → zdroje a redakčná informácia → relevantné pokračovanie.

Pri zložitejšej téme pomôžu tri overené hlavné body, vysvetlenie pojmov
a konkrétny dopad na čitateľa. Krátku správu netreba mechanicky rozširovať.
Pri ekonomických témach môže tabuľka alebo graf s uvedeným zdrojom vysvetliť
viac než všeobecná ilustrácia obchodnej miestnosti.

Zdrojové odkazy, redakčná zodpovednosť a možnosť požiadať o opravu majú byť
ľahko dostupné pri článku. Tiráž už zodpovednú osobu uvádza; odporúčanie je
prepojiť túto informáciu s čítaním. Meno konkrétneho kontrolóra zobrazovať
iba vtedy, keď sa jeho kontrola skutočne eviduje.

### Jednotný vizuálny systém

Spoločné pravidlá pre typografiu, šírku textu, medzery, nadpisy, karty,
metaúdaje, odkazy a svetlý/tmavý režim. Rubriky môže rozlišovať akcent a
obsahová kompozícia. Záhrada, Záhady a Horoskopy môžu zachovať svoj charakter.

Prístupnosť overiť klávesnicou, zväčšením textu, čítačkou, kontrastom
a dotykovým ovládaním. Existujúci `skip-link` a responzívny základ sú užitočné.

## Psychológia čítania a obchodný prínos

Prvá návšteva má dať jasnú hodnotu: čitateľ rýchlo pochopí udalosť a jej význam.
Presné označenia, zodpovednosť a dohľadateľné zdroje podporujú dôveru.
Relevantné pokračovanie vytvára dôvod otvoriť ďalší článok.
Pravidelný, realisticky splniteľný formát vytvára dôvod vrátiť sa.

Odporúčaná skúška: stručný výber „Novinko za 5 minút“ s ukážkou vydania.
Najprv overiť redakčnú kapacitu a záujem; e-mailový odber zaviesť s jasnou
frekvenciou a jednoduchým odhlásením. Ponuku umiestniť po užitočnom obsahu.
Sľúbenú dĺžku aj periodicitu musí reálna produkcia dodržiavať.

Vlastný obsah by mal postupne prinášať rozpoznateľnú hodnotu: vysvetlenia
pre slovenského čitateľa, tematické príručky a návraty k významným udalostiam.
Pri externom článku označiť, že odkaz vedie napríklad na Denník N alebo SME.

Reklamu plánovať podľa témy a kontextu. Existujúce bannery majú byť jasne
označené a primerane veľké. Výkon reklamy vyhodnocovať spolu s dočítanosťou
a návratnosťou čitateľov. Platené komerčné spolupráce potrebujú vlastné
označenie a oddelenie od redakčného rozhodovania.

## Technický základ a meranie

Domovská stránka skladá články až JavaScriptom; základné serverovo vrátené
HTML obsahuje najmä navigáciu a obal. Články už serverové vykreslenie majú.
Zmysel má doplniť serverovo dostupný obsah pre hlavné rubriky a stabilné
adresy ako `/ekonomika` či `/krypto`, s vlastnými metadátami a kanonickou URL.
Zmena adresy sama osebe SEO nezabezpečí a musí zachovať existujúce odkazy.

Výkon sa v tomto audite nemeral podľa Core Web Vitals. Odporúčaný cieľ podľa
Google: LCP do 2,5 s, INP do 200 ms a CLS do 0,1 na 75. percentile reálnych
návštev, osobitne pre mobil a počítač. Pri malej návštevnosti doplniť meranie
kontrolovanými testami; výsledok jedného lokálneho testu nie je údaj z prevádzky.

V existujúcej analytike so súhlasom sledovať: otvorenie článku z úvodu,
prechod na relevantné pokračovanie, výsledky hľadania a klik na ne,
návrat čitateľa za 7/30 dní a prípadné prihlásenie na odber. Posun na koniec
stránky je iba približný signál čítania. Nezhromažďovať zbytočne celé hľadané
výrazy. Bez východiskových dát nesľubovať percentuálny rast.

## Poradie realizácie

1. Opraviť vyhľadávanie, označenie obrázkov a význam času obnovenia; nasadiť
   už pripravené zjednotenie dátumov. Overiť na mobile aj s prázdnymi výsledkami.
2. Upraviť mobilnú hierarchiu, zjednotiť navigáciu a detail článku, umožniť
   vyvážený redakčný výber hlavnej správy a relevantné pokračovanie.
3. Doplniť serverovo dostupné rubriky a kontrolu výkonu; nastaviť východiskové
   meranie. Otestovať orientáciu s niekoľkými reálnymi čitateľmi.
4. Pilot pravidelného prehľadu a odberu, tematické príručky a obchodné formáty
   podľa skutočnej návštevnosti a redakčnej kapacity.

Prvé úpravy možno postaviť na existujúcom stacku bez nových platených AI
volaní. Produkčný deploy podľa projektovej dokumentácie stojí 15 Netlify
kreditov; súvisiace dokončené úpravy preto nasadzovať spolu. Prípadný e-mailový
nástroj vybrať a naceniť až podľa objemu odberateľov a rozosielania.

## Podklady

- Vlastná kontrola [Novinko](https://novinko.sk/), uvedených rubrík a detailu,
  21. 10. 2026 približne o 18:45 slovenského času.
- [Nielsen Norman Group: Trustworthiness in Web Design](https://www.nngroup.com/articles/trustworthy-design/):
  kvalita dizajnu, transparentnosť, aktuálnosť obsahu a väzby na ďalšie zdroje
  ako faktory dôvery; zrozumiteľná navigácia a funkčné detaily.
- [Reuters Institute: Digital News Report 2026](https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary):
  zmeny návykov, preťaženie správami a význam dôvery a vysvetlenia súvislostí.
  Medzinárodná štúdia nepredstavuje prieskum čitateľov Novinka.
- [Google: Web Vitals](https://web.dev/articles/vitals):
  definície, prahové hodnoty a meranie v reálnej prevádzke.
