// IMPORTANCE SCORING — koľko "stojí za zverejnenie" (0-100).
// Software-first: žiadne AI, len signály z faktov. Používa to 06-chief-editor
// na výber, čo sa vôbec napíše. Prahy sú laditeľné konštantami nižšie.
//
// Signály:
//   - typ udalosti (regulácia/upgrade >> bežný cenový pohyb)
//   - veľkosť pohybu (|24h %|)
//   - význam aktíva (trhová kapitalizácia)
//   - likvidita (objem / kapitalizácia — tenký objem = podozrivý/manipulovateľný)
//   - súbeh zdrojov (viac zdrojov o tej istej veci = väčšia story)

import { eventBaseFor } from '../sections/index.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Základné skóre podľa typu udalosti sa načíta z registra sekcií (per desk).
// Číselné signály nižšie (veľkosť pohybu, kapitalizácia, likvidita) sú spoločné
// a pre textové sekcie ako AI sa jednoducho nespustia (nemajú market_cap/price).

// Body za význam aktíva (trhová kapitalizácia v USD).
function mcapPoints(mcap) {
  if (mcap == null) return 0;
  if (mcap >= 100e9) return 45;   // BTC, ETH
  if (mcap >= 10e9) return 35;    // top altcoiny (SOL, …)
  if (mcap >= 1e9) return 22;
  if (mcap >= 250e6) return 10;
  if (mcap >= 50e6) return 3;
  return -5;                      // microcap
}

// Body za likviditu (objem 24h / kapitalizácia).
function liquidityPoints(vol, mcap) {
  if (vol == null || !mcap) return 0;
  const r = vol / mcap;
  if (r >= 0.15) return 12;       // veľmi aktívne
  if (r >= 0.05) return 6;
  if (r >= 0.01) return 0;
  return -12;                     // tenký objem = podozrivé
}

function metric(facts, claim) {
  const f = (facts.facts ?? []).find((x) => x.claim === claim);
  return typeof f?.value === 'number' ? f.value : null;
}

// Vráti { score, reasons[] } pre transparentnosť. `sectionId` vyberá event profil.
export function scoreImportance(facts, sectionId = 'krypto') {
  const eventBase = eventBaseFor(sectionId);
  const et = facts.event_type ?? 'other';
  const sourceCount = facts.source_count
    ?? new Set((facts.facts ?? []).map((f) => f.source_url)).size;
  const confluence = Math.min(Math.max(sourceCount - 1, 0) * 5, 20);
  const reasons = [];

  // Governance fóra = insider/technické (návrhy, granty, post-mortemy). Bez ohľadu
  // na to, ako AI udalosť označí, drž ich nízko — nezahlcujú širšie správy.
  if ((facts.facts ?? []).some((f) => /governance/i.test(f.source_name || ''))) {
    return { score: clamp(eventBase.governance + confluence, 0, 100),
      reasons: ['governance zdroj → nízke skóre (insider)'] };
  }

  if (et === 'price_move' || et === 'tvl_shift') {
    const change = Math.abs(metric(facts, 'change_24h_pct') ?? 0);
    // Veľkosť aktíva: cena → kapitalizácia; TVL → samotné TVL.
    const size = metric(facts, 'market_cap_usd') ?? metric(facts, 'tvl_usd');
    const vol = metric(facts, 'volume_24h_usd');

    const magPts = Math.min(change, 25) * 1.2;
    const sizePts = mcapPoints(size);
    const liqPts = liquidityPoints(vol, size);

    reasons.push(`pohyb ${change.toFixed(1)}% (+${magPts.toFixed(0)})`);
    reasons.push(`veľkosť ${size ? '$' + (size / 1e9).toFixed(1) + 'B' : '?'} (${sizePts >= 0 ? '+' : ''}${sizePts})`);
    if (confluence) reasons.push(`súbeh ${sourceCount} zdrojov (+${confluence})`);

    return { score: clamp(magPts + sizePts + liqPts + confluence, 0, 100), reasons };
  }

  // Text/oznámenia: základ podľa typu + súbeh zdrojov.
  const base = eventBase[et] ?? eventBase.other;
  reasons.push(`typ '${et}' (+${base})`);
  if (confluence) reasons.push(`súbeh ${sourceCount} zdrojov (+${confluence})`);
  return { score: clamp(base + confluence, 0, 100), reasons };
}
