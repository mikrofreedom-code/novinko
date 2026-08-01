// Vygeneruje _site/_headers s Content-Security-Policy.
//
// PREČO HASHE A NIE 'unsafe-inline':
// Stránky majú svoje JS priamo v HTML (<script> bez src). Keby sme povolili
// 'unsafe-inline', CSP by povolila AJ kód, ktorý do stránky prepašuje útočník
// — vrátane `onerror=` v podstrčenom <img> — a proti XSS by nedala prakticky
// nič. Preto z každého inline bloku spočítame SHA-256 a do politiky dáme len
// tie. Čokoľvek iné (teda čokoľvek podstrčené) prehliadač odmietne spustiť.
// Hashe navyše NEpovoľujú inline event handlery, čo je presne to, čo chceme;
// stránky žiadne nemajú (overené), takže sa nič nerozbije.
//
// PREČO `/*` A NIE PODĽA STRÁNOK:
// Jedna politika pre všetky cesty pokryje aj „pekné" URL (/archiv) a prípadné
// nové súbory. Pri delení podľa stránok by sa na nepokrytú cestu poslalo bez
// CSP. Únia hashov je v praxi rovnako silná — útočník ani tak nevie pridať
// vlastný skript, len by mu prešiel náš vlastný kód na inej stránke.
//
// POZOR NA SKENER TAJOMSTIEV NETLIFY:
// Do výstupu zámerne nepíšeme konkrétnu hodnotu SUPABASE_URL, ale
// `https://*.supabase.co`. Skener hľadá hodnoty premenných prostredia vo
// vygenerovaných súboroch a zhodil by build — presne to už tento repozitár
// zrazilo dvakrát (deploye 1653552 a 2066b29).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = process.argv[2] || "_site";

// Vytiahne obsah <script> BEZ atribútu src. Skripty so src (TradingView) sa
// nehashujú — ich telo je len konfigurácia, prehliadač ho nespúšťa ako kód.
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

const hashes = new Set();
let pages = 0;

for (const file of readdirSync(OUT_DIR).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(join(OUT_DIR, file), "utf8");
  let m;
  let n = 0;
  while ((m = INLINE_SCRIPT.exec(html))) {
    // Hashuje sa PRESNE to, čo je medzi značkami — vrátane odsadenia
    // a odriadkovaní. Jediný znak navyše a prehliadač skript odmietne.
    hashes.add("'sha256-" + createHash("sha256").update(m[1], "utf8").digest("base64") + "'");
    n++;
  }
  pages++;
  if (n) console.log(`  ${file}: ${n} inline <script>`);
}

const csp = [
  "default-src 'self'",
  `script-src 'self' https://s3.tradingview.com ${[...hashes].join(" ")}`,
  // 'unsafe-inline' pre štýly je nutné: každá stránka má <style> blok, v HTML
  // je 34 style="…" atribútov a TradingView si vkladá vlastné. Riziko je
  // rádovo nižšie než pri skriptoch — cez CSS sa kód nespustí.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.supabase.co",
  // docs.google.com: archiv.html a clanok.html si ťahajú publikovaný CSV hárku
  // priamo z prehliadača (nie cez našu funkciu). Bez tohto zostane archív aj
  // každý článok prázdny — overené v prehliadači, hlásilo to
  // „Chyba pri načítavaní archívu". googleusercontent.com je cieľ presmerovania,
  // na ktorý Google export CSV posiela.
  "connect-src 'self' https://api.open-meteo.com https://docs.google.com https://*.googleusercontent.com",
  // TradingView vykresľuje widgety do iframe na tradingview-widget.com (nie na
  // tradingview.com) — bez tejto domény zostanú grafy a tickery prázdne.
  // Zistené v prehliadači: „Please update your CSP rules to allow the
  // tradingview-widget.com origin for frame-src."
  "frame-src https://*.tradingview.com https://*.tradingview-widget.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

writeFileSync(join(OUT_DIR, "_headers"), `/*\n  Content-Security-Policy: ${csp}\n`);

console.log(`CSP zapísaná do ${OUT_DIR}/_headers — ${pages} stránok, ${hashes.size} hashov skriptov`);
