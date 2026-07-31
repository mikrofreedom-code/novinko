#!/usr/bin/env bash
# Poskladá VEREJNÝ web do _site/. Netlify zverejní len tento priečinok.
#
# PREČO VZNIKOL (2026-07-31): netlify.toml mal `publish = "."`, čo znamená
# „zverejni celý repozitár". Na živom webe tak boli verejne dostupné:
#   novinko.netlify.app/netlify/lib/config.js   (HTTP 200)
#   novinko.netlify.app/netlify/lib/feeds.js    (HTTP 200)
#   novinko.netlify.app/package.json            (HTTP 200)
# Po zlúčení s redakciou by k tomu pribudli CLAUDE.md, PLAN.txt, db/schema.sql
# a celý priečinok „novinko pravidla". Deploy 1653552 preto zlyhal — Netlify
# skener tajomstiev našiel hodnotu SUPABASE_URL v redakcia/content/
# krypto-skola/.images.json, ktorý sa mal zverejniť.
#
# Web nemá žiadne lokálne CSS, JS ani obrázky — fonty a grafy sú z CDN,
# obrázky článkov zo Supabase, dáta z /.netlify/functions/. Stačia teda
# HTML súbory. Funkcie sa nasadzujú zvlášť (functions = "netlify/functions"),
# publikačný priečinok sa ich netýka.
#
# PRIDÁVAŠ NOVÝ SÚBOR NA WEB? Ak to nie je .html, dopíš ho do zoznamu VOLITELNE
# nižšie — inak sa na produkciu nedostane.
set -euo pipefail

OUT="_site"
rm -rf "$OUT"
mkdir -p "$OUT"

# Všetky stránky webu.
cp -- *.html "$OUT"/

# Súbory, ktoré web zatiaľ nemá, ale keď pribudnú, majú ísť von tiež.
VOLITELNE=(robots.txt sitemap.xml favicon.ico _redirects _headers)
for f in "${VOLITELNE[@]}"; do
  [ -f "$f" ] && cp -- "$f" "$OUT"/
done

echo "web poskladaný do $OUT/ — $(find "$OUT" -type f | wc -l) súborov:"
find "$OUT" -type f -printf '  %f\n' | sort
