# Záhady a fenomény — redakčné pravidlá V1

Rubrika pokrýva historické záhady, tajomné miesta, vedu a vesmír, UFO/UAP,
legendy, folklór, povery, mágiu, ezoteriku, sny, symboliku, astrológiu, tarot
a numerológiu. Slovenské témy majú vlastnú sériu Tajomné Slovensko.

**Fascinujúce príbehy. Overené fakty. Otvorené otázky.**

## Pri ručnom publikovaní

1. Zvoľ jednu hlavnú podkategóriu a obsahový typ F/M/H/L/E/N. Typ opisuje
   prevládajúcu povahu článku, nie pravdivosť každej vety.
2. Každé podstatné faktografické tvrdenie musí mať dohľadateľný zdroj. Pri
   legendách dolož aspoň pôvod a historický kontext, ak ich v texte uvádzaš.
3. Oddeľ fakt, hypotézu, tradíciu, legendu a ezoterický výklad. Pri neoverenej
   informácii použi „Informáciu sa nepodarilo nezávisle overiť.“
4. Uveď známe prirodzené alebo vedecké vysvetlenie. „Nevysvetlené“ neznamená
   „nadprirodzené“ a UAP neznamená mimozemský pôvod.
5. Ezoterický výklad, horoskop a tarot opisuj ako tradíciu či symbolický
   obsah. Žiadny z nich nesmie sľubovať diagnózu, liečbu ani zaručenú predpoveď.
6. Titulný obrázok musí mať určený pôvod. AI vizuál označ „AI ilustrácia“;
   nikdy ho nevydávaj za fotografiu historickej udalosti.
7. Pred novým článkom skontroluj kanonickú tému a možné duplicity. Nový vývoj
   k rovnakej téme spravidla patrí do aktualizácie existujúceho článku. Ak
   vznikne samostatný článok, zapíš konkrétny dôvod nového redakčného uhla.

## Dátový kontrakt

Publikovaný text je v Google Sheete `articles` (A:J). Stĺpec J obsahuje JSON
metadáta rubriky vrátane kanonickej témy, zdrojov, typu, série, SEO údajov
a stabilného slugu. Evidencia tém v Supabase `mystery_topics` je zrkadlom
publikovaných tém; `mystery_topic_articles` spája jednu tému s jej článkami.
Obe tabuľky sú základom pre neskoršiu AI prípravu. Súbory obrázkov sú
v úložisku; hárok uchováva URL.

Manuálny formulár publikuje priamo. Pred odoslaním použi náhľad a skontroluj
zdroje, označenie typu obsahu a obrázka. Aktualizáciu začni načítaním článku
podľa ID, aby ostala zachovaná jeho adresa a dátum prvého vydania.
