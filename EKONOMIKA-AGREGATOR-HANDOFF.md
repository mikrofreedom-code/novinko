# Ekonomika v súkromnom prehľade správ

Pridané 21. 10. 2026 do `redakcia/lib/_shared/digest-feeds.js`.
Sekcia `ekonomika` je v odosielacom skripte už podporovaná. Fed a ECB majú P1;
ostatných 20 feedov P2. Existujúce limity a rozvrh prehľadu ostávajú v platnosti.

## Kontrola zdrojov

Všetkých 22 adries pri kontrole vrátilo HTTP 200 a parsovateľné položky s odkazmi.
Dátum poslednej položky je uvedený v UTC; nejde o garanciu budúcej dostupnosti.

| Zdroj | Položiek | Najnovšia položka (UTC) |
|---|---:|---|
| BBC News – Business | 54 | 2026-10-21T19:54:16.000Z |
| Bloomberg – Economics | 20 | 2026-10-21T19:29:09.000Z |
| Bloomberg – Markets | 20 | 2026-10-21T20:23:04.000Z |
| Bloomberg – Všetky správy | 20 | 2026-10-21T20:23:04.000Z |
| Business Insider | 20 | 2026-10-21T20:14:37.000Z |
| CNBC – Economy | 30 | 2026-10-21T11:20:58.000Z |
| CNBC – Top News | 30 | 2026-10-21T20:24:04.000Z |
| ECB – Press Releases | 15 | 2026-10-21T08:00:00.000Z |
| Federal Reserve – Press Releases | 20 | 2026-10-16T15:00:00.000Z |
| Financial Times – Global Economy | 25 | 2026-10-21T17:43:17.000Z |
| Financial Times – Hlavná stránka | 13 | 2026-10-21T20:09:34.000Z |
| Financial Times – Markets | 25 | 2026-10-21T18:46:59.000Z |
| Fortune | 10 | 2026-10-21T18:48:38.000Z |
| Harvard Business Review | 100 | 2026-10-21T12:25:11.000Z |
| Investing.com – News | 10 | 2026-10-21T18:22:35.000Z |
| MarketWatch – Top Stories | 10 | 2026-10-21T20:18:00.000Z |
| Seeking Alpha – All Articles | 30 | 2026-10-21T20:20:37.000Z |
| Seeking Alpha – Breaking News | 7 | 2026-10-21T20:25:22.000Z |
| The Economist – Business | 300 | 2026-10-21T18:37:28.000Z |
| The Economist – Finance and Economics | 300 | 2026-10-20T18:32:09.000Z |
| Wall Street Journal – Economy | 36 | 2026-10-21T09:50:00.000Z |
| Wall Street Journal – Markets | 61 | 2026-10-21T19:59:00.000Z |

HBR používa `ns6:feed`/`ns6:entry` a relatívne odkazy. Spoločný RSS klient má
pre doménu `feeds.hbr.org` samostatný adaptér, ktorý zachováva pôvodné ID a dátumy
a dopĺňa odkazy na `https://hbr.org`. Dodaná HTTP adresa funguje; HTTPS variant
pri kontrole nebol dostupný.

Presmerovania FT Home, MarketWatch a Fortune boli overené. Fed má poslednú položku
zo 16. 10.; pri bežnom 24-hodinovom okne sa preto nezobrazí, kým nepribudne nová.

Kontrola neodosielala Telegram správy, nepoužívala AI a nemenila seen-state.
Cena kontroly: $0. Pri bežnom behu so zapnutým DIGEST_TRANSLATE sa ekonomické
titulky prekladajú existujúcim mechanizmom; pribudne cena prekladu tejto sekcie.
Táto dodatočná cena ešte nebola nameraná; zaznamená sa pod digest-preklad.
Zmena lokálneho agregátora nepotrebuje Netlify deploy.

Overenie: test/digest-economy.test.mjs pokrýva konfiguráciu, HBR aj celý dry-run
s pripravenými dátami vrátane poradia P1, limitu 20 a výpadku jedného feedu.
Živé overenie prešlo aj cez presný sieťový klient pre HBR (100 funkčných odkazov).
