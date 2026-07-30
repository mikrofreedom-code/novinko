#!/usr/bin/env bash
# Cron wrapper pre pipeline. Ošetruje nvm PATH (cron má holé prostredie),
# zámok proti prekrývaniu behov a logovanie s časovou pečiatkou.
set -euo pipefail

# Cesta sa odvodí od umiestnenia tohto skriptu → presun priečinka nič nerozbije.
# (Predtým bola natvrdo "/home/mikrofreedom/Plocha/novinko-redakcia".)
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT"

# Načítaj nvm, aby `node` existoval aj pod cronom.
export NVM_DIR="/home/mikrofreedom/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

mkdir -p logs
LOG="$PROJECT/logs/pipeline.log"

# Zámok: ak predošlý beh ešte beží, tento preskoč (nehromadiť behy).
exec 9>"$PROJECT/.pipeline.lock"
if ! flock -n 9; then
  echo "$(date -Is) SKIP — predošlý beh ešte beží" >> "$LOG"
  exit 0
fi

echo "===== $(date -Is) START =====" >> "$LOG"
node --env-file=.env scripts/run-pipeline.mjs >> "$LOG" 2>&1
echo "===== $(date -Is) END (exit $?) =====" >> "$LOG"
