#!/usr/bin/env bash
# Cron wrapper pre scripts/digest.mjs (súkromný prehľad správ, samostatný od
# hlavnej redakčnej pipeline) — rovnaký vzor ako cron-run.sh: nvm PATH,
# vlastný zámok (nemieša sa so zámkom pipeline.lock), logovanie s pečiatkou.
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT"

export NVM_DIR="/home/mikrofreedom/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

mkdir -p logs
LOG="$PROJECT/logs/digest.log"

exec 9>"$PROJECT/.digest.lock"
if ! flock -n 9; then
  echo "$(date -Is) SKIP — predošlý beh prehľadu ešte beží" >> "$LOG"
  exit 0
fi

echo "===== $(date -Is) START =====" >> "$LOG"
node --env-file=.env scripts/digest.mjs >> "$LOG" 2>&1
echo "===== $(date -Is) END (exit $?) =====" >> "$LOG"
