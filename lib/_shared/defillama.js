// DEFILLAMA CLIENT — Layer A (dáta o TVL protokolov). Bezplatné API, bez kľúča.
const BASE = 'https://api.llama.fi';

// Top protokoly podľa TVL, vrátane 24h/7d zmeny TVL.
export async function topProtocols({ limit = 100 } = {}) {
  const res = await fetch(`${BASE}/protocols`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`DefiLlama ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const all = await res.json();
  return (Array.isArray(all) ? all : [])
    .filter((p) => typeof p.tvl === 'number' && p.tvl > 0)
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, limit)
    .map((p) => ({
      id: p.slug || p.name,
      name: p.name,
      tvl_usd: p.tvl,
      change_24h_pct: typeof p.change_1d === 'number' ? p.change_1d : null,
      change_7d_pct: typeof p.change_7d === 'number' ? p.change_7d : null,
      chain: p.chain ?? null,
      category: p.category ?? null,
    }));
}
