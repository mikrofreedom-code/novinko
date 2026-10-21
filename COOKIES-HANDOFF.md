# Cookies a súkromie — 21. 10. 2026

Spoločné UI a správa súhlasu: `assets/ga4-consent.js`, vzhľad iba v `assets/consent.css`.
Verejné statické stránky ich dostávajú pri builde, SSR cez `netlify/lib/clanok-render.js`.
Nastavenia sú dostupné v päte každej verejnej stránky. Bez súhlasu sa GA4 ani TradingView
nenačítajú. TradingView kontroluje `NovinkoConsent.allows('external')` v spoločnom
`assets/market-widgets.js`. Analytika má samostatnú voľbu. Reklamné sledovanie je neaktívne.

Voľba v localStorage `novinko_consent_v2` obsahuje verziu, čas a kategórie; platí 180 dní.
Staré súhlasy sa nerozširujú. Odvolanie obnoví stránku, zakáže GA a vymaže dostupné
`_ga` cookies vlastnej domény. Cudzie cookies nemôžeme vymazať. Zmeny medzi kartami
vyvolajú obnovenie. Bez dostupného úložiska sa voľba pamätá iba v aktuálnej stránke.

Pri pridávaní služby:
- Uviesť skutočného poskytovateľa a účel v kategóriách a `sukromie.html`.
- Loader podmieniť konkrétnym `allows(...)`; nespoliehať sa len na text v lište.
- Pri novom účele/poskytovateľovi posúdiť nový súhlas a zvýšiť `policyVersion`.
- Nová kategória vyžaduje aj uloženie/validáciu voľby a obsluhu odvolania; marketing
  je zámerne natvrdo vypnutý, nie predbežne odsúhlasený.
- Kozmetické zmeny nevyžadujú zmenu verzie.

Google Fonts zostávajú externými požiadavkami pri zobrazení stránky; táto úprava
neprevádza všetky externé zdroje na lokálne. Zásady to výslovne uvádzajú.

Overenie: `node --test test/*.test.cjs` (11 súborov), build a `git diff --check`.
Chrome s lokálnymi odpoveďami a CSP: 320/390/1440 px, žiadny GA/TradingView request
pred súhlasom, samostatné kategórie, aktivácia widgetov, odmietnutie, odvolanie,
vymazanie GA cookies, pretrvanie voľby, klávesnica, stará verzia a starý súhlas.
Browser test v tejto session: `/tmp/novinko-cookie-browser.cjs`.
Zmeny nie sú nasadené.
