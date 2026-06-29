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

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Základné skóre podľa typu udalosti (text/oznámenia).
const EVENT_BASE = {
  regulatory: 90,        // MiCA, SEC, centrálne banky — najdôležitejšie
  governance: 60,
  protocol_release: 55,  // upgrade protokolu
  listing: 50,
  tvl_shift: 48,
  announcement: 45,
  other: 30,
};

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

// Vráti { score, reasons[] } pre transparentnosť.
export function scoreImportance(facts) {
  const et = facts.event_type ?? 'other';
  const sourceCount = facts.source_count
    ?? new Set((facts.facts ?? []).map((f) => f.source_url)).size;
  const confluence = Math.min(Math.max(sourceCount - 1, 0) * 5, 20);
  const reasons = [];

  if (et === 'price_move' || et === 'tvl_shift') {
    const change = Math.abs(metric(facts, 'change_24h_pct') ?? 0);
    const mcap = metric(facts, 'market_cap_usd');
    const vol = metric(facts, 'volume_24h_usd');

    const magPts = Math.min(change, 25) * 1.2;
    const mcapPts = mcapPoints(mcap);
    const liqPts = liquidityPoints(vol, mcap);

    reasons.push(`pohyb ${change.toFixed(1)}% (+${magPts.toFixed(0)})`);
    reasons.push(`mcap ${mcap ? '$' + (mcap / 1e9).toFixed(1) + 'B' : '?'} (${mcapPts >= 0 ? '+' : ''}${mcapPts})`);
    reasons.push(`likvidita (${liqPts >= 0 ? '+' : ''}${liqPts})`);
    if (confluence) reasons.push(`súbeh ${sourceCount} zdrojov (+${confluence})`);

    return { score: clamp(magPts + mcapPts + liqPts + confluence, 0, 100), reasons };
  }

  // Text/oznámenia: základ podľa typu + súbeh zdrojov.
  const base = EVENT_BASE[et] ?? EVENT_BASE.other;
  reasons.push(`typ '${et}' (+${base})`);
  if (confluence) reasons.push(`súbeh ${sourceCount} zdrojov (+${confluence})`);
  return { score: clamp(base + confluence, 0, 100), reasons };
}
