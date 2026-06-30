// FEAR & GREED INDEX — nálada trhu (alternative.me). Bezplatné, bez kľúča.
// Vracia { value 0-100, classification }. Newsworthy hlavne pri extrémoch.
export async function fearGreed() {
  const res = await fetch('https://api.alternative.me/fng/?limit=1', { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`F&G ${res.status}`);
  const d = (await res.json())?.data?.[0];
  if (!d) return null;
  return { value: Number(d.value), classification: d.value_classification };
}

// Slovenský preklad klasifikácie.
export const FNG_SK = {
  'Extreme Fear': 'extrémny strach',
  'Fear': 'strach',
  'Neutral': 'neutrál',
  'Greed': 'chamtivosť',
  'Extreme Greed': 'extrémna chamtivosť',
};
