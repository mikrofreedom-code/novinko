// LEARNING LOG — lokálny archív surových udalostí pre budúci Learning Engine (14).
// Supabase queue zostáva JEDINÝ zdroj pravdy o stave článku — toto je len
// append-only archív na disku (korekcie, verdikty, zamietnutia...), z ktorého
// sa raz postaví skutočná logika učenia, keď budú reálne publikačné dáta.
//
// Úložisko: logs/learning/learning-YYYYMMDD-NNN.jsonl, rotácia po LEARNING_LOG_ROTATE_MB.
// Keď celkový obsah priečinka prekročí LEARNING_LOG_WARN_GB (default 5 GB), vypíše
// varovanie do konzoly/pipeline.log — presun starých súborov na externý HDD je ručný.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../logs/learning');
const ROTATE_BYTES = Number(process.env.LEARNING_LOG_ROTATE_MB ?? 250) * 1024 * 1024;
const WARN_BYTES = Number(process.env.LEARNING_LOG_WARN_GB ?? 5) * 1024 ** 3;
const NAME_RE = /^learning-(\d{8})-(\d{3})\.jsonl$/;

let _sizeCache = { ts: 0, bytes: 0 };

function todayStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

export async function listLogFiles() {
  try { return (await fs.readdir(DIR)).filter((f) => NAME_RE.test(f)).sort(); }
  catch { return []; }
}

// Meno súboru, do ktorého sa má práve teraz zapisovať (vytvorí priečinok, ak chýba).
export async function activeFile() {
  await fs.mkdir(DIR, { recursive: true });
  const stamp = todayStamp();
  const todays = (await listLogFiles()).filter((f) => f.startsWith(`learning-${stamp}-`));
  const last = todays.at(-1);
  if (last) {
    const { size } = await fs.stat(path.join(DIR, last)).catch(() => ({ size: 0 }));
    if (size < ROTATE_BYTES) return last;
    const seq = Number(last.match(NAME_RE)[2]) + 1;
    return `learning-${stamp}-${String(seq).padStart(3, '0')}.jsonl`;
  }
  return `learning-${stamp}-001.jsonl`;
}

// Celková veľkosť archívu v bajtoch (cache 60 s, rovnaký vzor ako cost.js).
export async function totalLogBytes() {
  if (Date.now() - _sizeCache.ts < 60_000) return _sizeCache.bytes;
  const files = await listLogFiles();
  let bytes = 0;
  for (const f of files) {
    const st = await fs.stat(path.join(DIR, f)).catch(() => null);
    if (st) bytes += st.size;
  }
  _sizeCache = { ts: Date.now(), bytes };
  return bytes;
}

async function warnIfFull() {
  const bytes = await totalLogBytes();
  if (bytes >= WARN_BYTES) {
    console.warn(`⚠️ [learning-log] archív má ${(bytes / 1024 ** 3).toFixed(2)} GB (limit ${(WARN_BYTES / 1024 ** 3).toFixed(0)} GB) — presuň staré súbory z logs/learning/ na externý HDD`);
  }
}

// Zapíš jednu udalosť (korekcia, verdikt, zamietnutie...) ako riadok JSONL.
// event: ľubovoľný plain object, napr. { stage, article_id, edit_type, before, after, reason }
export async function logLearningEvent(event) {
  const file = await activeFile();
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
  await fs.appendFile(path.join(DIR, file), line, 'utf8');
  await warnIfFull();
}
