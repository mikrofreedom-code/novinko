// PRICE TEMPLATE — cenové články bez AI (šablóna s číslami).
// Cenový pohyb je formulaický → drahý Sonnet netreba. Drahú AI šetríme
// na skutočné texty (oznámenia, regulácie). Rodovo bezpečné (kotvíme na "cena").

// Slovenské formátovanie čísel: medzera tisíce, čiarka desatinná.
function nf(x, decimals) {
  return Number(x).toLocaleString('sk-SK', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
}
function fmtPrice(p) {
  const d = p >= 1000 ? 0 : p >= 1 ? 2 : p >= 0.01 ? 4 : 6;
  return `${nf(p, d)} USD`;
}
function fmtBig(x) {
  if (x >= 1e9) return `${nf(x / 1e9, 1)} mld. USD`;
  if (x >= 1e6) return `${nf(x / 1e6, 1)} mil. USD`;
  return `${nf(x, 0)} USD`;
}

function metric(facts, claim) {
  const f = (facts.facts ?? []).find((x) => x.claim === claim);
  return typeof f?.value === 'number' ? f.value : null;
}

// Vráti hotový článok zo šablóny, alebo null ak položka NIE je čistý cenový pohyb.
// Podmienky: event_type price_move, žiadna povinná atribúcia, len číselné fakty.
export function tryPriceTemplate(facts) {
  if (facts.event_type !== 'price_move') return null;
  if (facts.attribution_required) return null;                 // sekundárny zdroj → radšej AI
  if ((facts.facts ?? []).some((f) => f.statement != null)) return null; // textový fakt → AI
  if (typeof facts.entity !== 'string' || !facts.entity) return null;

  const change = metric(facts, 'change_24h_pct');
  const price = metric(facts, 'price_usd');
  if (typeof change !== 'number' || typeof price !== 'number') return null;

  const vol = metric(facts, 'volume_24h_usd');
  const mcap = metric(facts, 'market_cap_usd');
  const e = facts.entity;
  const down = change < 0;
  const pct = nf(Math.abs(change), 1);

  const headline = `Cena ${e} ${down ? 'klesla' : 'vzrástla'} o ${pct} %`;
  const perex = `Cena tokenu ${e} sa za posledných 24 hodín ${down ? 'znížila' : 'zvýšila'} `
              + `o ${pct} % na ${fmtPrice(price)}.`;

  const p1 = `Token ${e} sa obchoduje na úrovni ${fmtPrice(price)}, čo predstavuje `
           + `${down ? 'pokles' : 'rast'} o ${pct} % za uplynulých 24 hodín.`;
  const p2parts = [];
  if (mcap) p2parts.push(`Trhová kapitalizácia ${e} dosahuje ${fmtBig(mcap)}.`);
  if (vol) p2parts.push(`Objem obchodov za posledný deň predstavoval ${fmtBig(vol)}.`);
  const body = [p1, p2parts.join(' ')].filter(Boolean).join('\n\n');

  return { headline, perex, body, attribution_used: false, generated_by: 'template' };
}

// TVL protokolu (DefiLlama) → šablóna bez AI.
export function tryTvlTemplate(facts) {
  if (facts.event_type !== 'tvl_shift' || facts.attribution_required) return null;
  if (typeof facts.entity !== 'string' || !facts.entity) return null;
  const change = metric(facts, 'change_24h_pct');
  const tvl = metric(facts, 'tvl_usd');
  if (typeof change !== 'number' || typeof tvl !== 'number') return null;

  const e = facts.entity;
  const down = change < 0;
  const pct = nf(Math.abs(change), 1);
  const headline = `TVL protokolu ${e} ${down ? 'kleslo' : 'vzrástlo'} o ${pct} %`;
  const perex = `Hodnota uzamknutá v protokole ${e} (TVL) sa za 24 hodín `
              + `${down ? 'znížila' : 'zvýšila'} o ${pct} % na ${fmtBig(tvl)}.`;
  const body = `Celková hodnota uzamknutá v protokole ${e} dosahuje ${fmtBig(tvl)}, `
             + `čo je ${down ? 'pokles' : 'rast'} o ${pct} % oproti predchádzajúcemu dňu.`
             + `\n\nTVL (total value locked) ukazuje, koľko prostriedkov používatelia `
             + `vložili do protokolu — je to jeden z ukazovateľov jeho aktivity a dôvery.`;

  return { headline, perex, body, attribution_used: false, generated_by: 'template' };
}

// Fear & Greed (nálada trhu) → šablóna bez AI.
export function trySentimentTemplate(facts) {
  if (facts.event_type !== 'sentiment') return null;
  const value = metric(facts, 'fng_value');
  if (typeof value !== 'number') return null;
  const FNG_SK = {
    'Extreme Fear': 'extrémny strach', 'Fear': 'strach', 'Neutral': 'neutrál',
    'Greed': 'chamtivosť', 'Extreme Greed': 'extrémna chamtivosť',
  };
  const sk = FNG_SK[facts.fng_classification] ?? facts.fng_classification ?? '';
  const high = value >= 50;
  const headline = `Index strachu a chamtivosti ukazuje ${sk} (${value})`;
  const perex = `Nálada na krypto trhu sa dostala do pásma „${sk}" — index strachu `
              + `a chamtivosti dosiahol hodnotu ${value} zo 100.`;
  const body = `Index strachu a chamtivosti (Fear & Greed Index) meria náladu na `
             + `krypto trhu na škále 0 až 100. Aktuálna hodnota ${value} znamená `
             + `${high ? 'prevahu chamtivosti' : 'prevahu strachu'} medzi investormi.`
             + `\n\nExtrémne hodnoty bývajú sledované ako možné body obratu — `
             + `extrémny strach historicky sprevádzal dná, extrémna chamtivosť vrcholy.`;

  return { headline, perex, body, attribution_used: false, generated_by: 'template' };
}
