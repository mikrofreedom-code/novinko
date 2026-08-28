#!/usr/bin/env python3
# ============================================================
# ZMENŠENIE RUČNE NAHRANÝCH FOTIEK  (jednorazové, 2026-08-28)
# ------------------------------------------------------------
#   python3 scripts/zmensi-fotky.py            # NASUCHO (vzorka + odhad)
#   python3 scripts/zmensi-fotky.py --plna      # nasucho, ale premeria všetky
#   python3 scripts/zmensi-fotky.py --apply     # OSTRO
#
# PREČO: priečinok manual/ má 108 fotiek za 116,5 MB, teda 1,08 MB na kus.
# Generované obrázky z Flux Schnell majú 43–53 kB. Rozdiel je ~22×, lebo
# formulár v publikovat.html nahráva súbor 1:1, bez zmenšenia a bez konverzie.
# Crawleri (Ahrefs, Google, náhľady na sieťach) prechádzajú celý sitemap a ku
# každému článku stiahnu obrázok — to je hlavný zdroj egressu.
#
# ČO ROBÍ: stiahne fotku, zmenší na max 1600 px na šírku, uloží ako WEBP q82
# a nahrá SPÄŤ NA TÚ ISTÚ CESTU (upsert).
#
# ⚠️ PREČO SA NEMENÍ CESTA ANI PRÍPONA:
# URL týchto fotiek žijú na TROCH miestach — hárok articles stĺpec H (to číta
# živý web), queue.article.image_url a content/krypto-skola/.images.json. Keby
# sa cesta zmenila, museli by sa prepísať všetky tri a stačilo by zabudnúť na
# jedno, aby sa na webe objavil prázdny rámček.
# Supabase servíruje Content-Type, ktorý mu nastavíme pri nahratí, NIE podľa
# prípony — overené: cesta končiaca na .png s webp obsahom vracia
# "Content-Type: image/webp" a prehliadač ju zobrazí správne. Prípona je len
# súčasť kľúča v úložisku, nič viac.
#
# PREČO PYTHON A NIE .mjs AKO ZVYŠOK:
# Node tu nemá čím obrázky spracovať — `sharp` je natívny balík ~30 MB a bolo
# by ho treba doinštalovať kvôli jednému behu. PIL je v systéme už teraz.
# Formulár (publikovat.html) sa rieši v JavaScripte, ten s týmto nesúvisí.
#
# ČO SA NEROBÍ:
#   • nemenia sa priečinky ai/ a krypto/ — tie sú generované a už sú webp
#   • fotka sa NEZVÄČŠUJE, ak je menšia než 1600 px
#   • ak by výsledok nebol menší než originál, súbor sa preskočí
#
# ZÁLOHA: originály sa pred prepísaním ukladajú do ../zaloha-fotiek/.
# ============================================================

import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

KOREN = Path(__file__).resolve().parent.parent          # …/redakcia
APPLY = "--apply" in sys.argv
PLNA = "--plna" in sys.argv or APPLY
VZORKA = 12                                              # koľko fotiek nasucho
MAX_SIRKA = 1600
KVALITA = 82
PREFIX = "manual/"
ZALOHA = KOREN / "zaloha-fotiek"

env = (KOREN / ".env").read_text(encoding="utf-8", errors="replace")


def z_env(meno: str) -> str:
    m = re.search(rf"^{meno}=(.*)$", env, re.M)
    if not m:
        raise SystemExit(f"chýba {meno} v redakcia/.env")
    return m.group(1).strip().strip('"').strip("'")


URL = z_env("SUPABASE_URL")
KEY = z_env("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = z_env("SUPABASE_BUCKET") if re.search(r"^SUPABASE_BUCKET=", env, re.M) else "article-images"
API = f"{URL}/storage/v1"
HLAVICKY = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def ziadost(method, cesta, data=None, extra=None, timeout=90):
    r = urllib.request.Request(f"{API}{cesta}", data=data, method=method)
    for k, v in {**HLAVICKY, **(extra or {})}.items():
        r.add_header(k, v)
    return urllib.request.urlopen(r, timeout=timeout)


def vypis_manual():
    """Všetky súbory v manual/, stránkovane."""
    von, offset = [], 0
    while True:
        telo = json.dumps({"prefix": PREFIX, "limit": 1000, "offset": offset,
                           "sortBy": {"column": "name", "order": "asc"}}).encode()
        d = json.loads(ziadost("POST", f"/object/list/{BUCKET}", telo,
                               {"Content-Type": "application/json"}).read())
        von += [{"cesta": PREFIX + x["name"], "velkost": (x.get("metadata") or {}).get("size", 0)}
                for x in d if x.get("id")]
        if len(d) < 1000:
            return von
        offset += 1000


def prekoduj(raw: bytes) -> bytes:
    """Zmenší na MAX_SIRKA a vráti WEBP. Priehľadnosť sa zachová."""
    im = Image.open(io.BytesIO(raw))
    # Fotky z mobilu nesú otočenie v EXIF. Bez tohto by sa niektoré prevrátili.
    im = ImageOps.exif_transpose(im)
    if im.width > MAX_SIRKA:
        im = im.resize((MAX_SIRKA, round(im.height * MAX_SIRKA / im.width)), Image.LANCZOS)
    ma_alfa = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if ma_alfa else "RGB")
    von = io.BytesIO()
    im.save(von, "WEBP", quality=KVALITA, method=6)
    return von.getvalue()


def main():
    subory = vypis_manual()
    subory.sort(key=lambda x: -x["velkost"])
    celkom_povodne = sum(x["velkost"] for x in subory)

    print("\n⚠️  OSTRÝ BEH — fotky sa prepíšu v úložisku\n" if APPLY
          else "\nNASUCHO — nič sa nemení\n")
    print(f"v manual/: {len(subory)} fotiek, {celkom_povodne / 1048576:.1f} MB "
          f"(priemer {celkom_povodne / max(len(subory), 1) / 1024:.0f} kB)")

    davka = subory if PLNA else subory[:VZORKA]
    if not PLNA:
        print(f"nasucho meriam {len(davka)} najväčších — pre všetky pridaj --plna, "
              f"pre ostrý beh --apply\n")
    else:
        print()

    if APPLY:
        ZALOHA.mkdir(parents=True, exist_ok=True)

    pred = po = 0
    hotove = preskocene = 0
    chyby = []

    for i, s in enumerate(davka, 1):
        try:
            raw = urllib.request.urlopen(f"{API}/object/public/{BUCKET}/{s['cesta']}",
                                         timeout=90).read()
            novy = prekoduj(raw)
        except Exception as e:                                  # noqa: BLE001
            chyby.append(f"{s['cesta']}: {type(e).__name__} {e}")
            continue

        # Nikdy nezhoršuj. Ak už je fotka dobre uložená, nechaj ju tak.
        if len(novy) >= len(raw):
            preskocene += 1
            pred += len(raw)
            po += len(raw)
            continue

        pred += len(raw)
        po += len(novy)

        if APPLY:
            (ZALOHA / Path(s["cesta"]).name).write_bytes(raw)
            try:
                ziadost("POST", f"/object/{BUCKET}/{s['cesta']}", novy,
                        {"Content-Type": "image/webp", "x-upsert": "true"})
            except urllib.error.HTTPError as e:
                chyby.append(f"{s['cesta']}: nahratie {e.code} {e.read()[:120]}")
                continue
        hotove += 1
        print(f"  [{i:3d}/{len(davka)}] {Path(s['cesta']).name:34s} "
              f"{len(raw) / 1024:7.0f} kB → {len(novy) / 1024:6.0f} kB "
              f"({100 - 100 * len(novy) / len(raw):.0f} % dole)")

    print(f"\n{'spracované' if APPLY else 'premerané'}: {hotove}, "
          f"preskočené (už malé): {preskocene}, chyby: {len(chyby)}")
    for ch in chyby[:10]:
        print(f"   ⚠️ {ch}")

    if pred:
        uspora = 100 - 100 * po / pred
        print(f"\n  {pred / 1048576:.1f} MB → {po / 1048576:.1f} MB   ({uspora:.0f} % dole)")
        if not PLNA:
            print(f"  odhad pre všetkých {len(subory)}: "
                  f"{celkom_povodne / 1048576:.1f} MB → "
                  f"{celkom_povodne * (po / pred) / 1048576:.1f} MB")

    if APPLY:
        print(f"\nHOTOVO. Originály v {ZALOHA}")
        print("URL sa nemenili, takže hárok, fronta ani .images.json sa nedotýkajú.")
        print("Over si pár článkov na novinko.sk a potom zálohu môžeš zmazať.")
    else:
        print("\n(len náhľad — spusti s --apply, ak sa to má naozaj prepísať)")


if __name__ == "__main__":
    main()
