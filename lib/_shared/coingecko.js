// COINGECKO CLIENT — Layer A (dáta). Bezplatné API bez kľúča;
// voliteľný demo kľúč (COINGECKO_API_KEY) zvyšuje limity.
const BASE = 'https://api.coingecko.com/api/v3';

function headers() {
  const h = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) h['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  return h;
}

// Top trhy podľa market cap, vrátane 24h zmeny. Jedno volanie = celý watchlist.
export async function topMarkets({ perPage = 100, page = 1 } = {}) {
  const url = `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc`
            + `&per_page=${perPage}&page=${page}&price_change_percentage=24h`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return res.json();
}
