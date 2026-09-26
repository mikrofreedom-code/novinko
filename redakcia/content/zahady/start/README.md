# Tri úvodné koncepty

Stav 26. 9. 2026: pripravené lokálne, **nezverejnené**. Nie sú zapísané do
Google Sheetu ani Supabase. Každý článok má text, perex, SEO, tematické
metadáta, zdroje a obrázok s atribúciou. Sú to krátke úvodné články,
nie dlhá séria Záhada týždňa.

| Koncept | Súbor na import |
|---|---|
| Mechanizmus z Antikythéry | `mechanizmus-z-antikythery.json` |
| Červení škriatkovia nad búrkami | `cerveni-skriatkovia-nad-burkami.json` |
| História tarotu | `historia-tarotu.json` |

Súbory `.md` slúžia na čítanie a `.facts.json` na kontrolu tvrdení voči
zdrojom. Importujú sa iba tri vyššie uvedené JSON súbory.

## Náhľad

Z koreňa projektu spusti `node scripts/preview-zahady.cjs` a otvor
http://127.0.0.1:4174/zahady.html. Na `/koncepty` sú odkazy na články,
stiahnutie JSON a redakciu. Náhľad nepoužíva databázu, má ukážkové dátumy,
zakazuje zápisy a nie je určený na verejné nasadenie.

## Publikovanie po nasadení

1. Nasadiť pripravený web aj funkcie. Obrázky sú súčasťou `assets/zahady/clanky/`.
2. Otvoriť `/publikovat.html` na nasadenom webe.
3. Rozbaliť **Načítať pripravený koncept Záhad a fenoménov** a vybrať JSON.
4. Skontrolovať text, odkazy na zdroje, atribúciu a dostupnosť obrázka.
   Podnadpisy začínajú `## ` a sú oddelené prázdnymi riadkami.
5. Použiť Náhľad, potom zadať redakčné heslo a publikovať jeden článok.
   Import sám nič nepublikuje. Kontrola duplicít sa vykoná pri publikovaní
   proti aktuálnemu archívu; prípadnú zhodu treba redakčne posúdiť.
6. Overiť článok v rubrike, zdroje a podnadpisy, metadata_json v Sheete
   a zrkadlo témy v Supabase. Až potom pokračovať ďalším konceptom.

Živé publikovanie a úplný produkčný priechod zostávajú na odskúšanie.
AI generovanie ani automatické publikovanie nie sú zapnuté.

## Obrázky

- Antikythéra: Marsyas, CC BY 2.5; originál aj licencia sú v zdrojoch článku.
  Konverzia do WebP, bez obsahovej úpravy fotografie.
- Červení škriatkovia: NASA/Matthew Dominick, fotografia z ISS,
  zdroj NASA uvedený v článku; zmenšenie a konverzia do WebP.
- Tarot: reprodukcia historickej karty Visconti-Sforza, Wikimedia Commons,
  public domain; konverzia do WebP. Pôvodný obrázok má nízke rozlíšenie.

Článkové obrázky nie sú AI ilustrácie. Úvodný vizuál rubriky je samostatne
označená AI ilustrácia.
