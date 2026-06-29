// FEED DATABÁZA — primárne Layer B/C text zdroje (RSS/Atom).
// Všetko PRIMÁRNE (oficiálne blogy a GitHub release feedy) → legálne čisté.
// Pridať zdroj = pridať riadok. `entity` je nápoveda (blog môže mať null,
// presnú entitu určí 05/Haiku z textu).
//
// source_type: 'primary' | 'secondary'  (sekundárne médiá NEpridávaj bez atribučného modelu)
// layer: 'B' (primárne oznámenia) | 'C' (rozšírené primárne: exchange, regulátor, governance)

export const FEEDS = [
  // --- Oficiálne blogy (Layer B) ---
  { name: 'Ethereum Foundation Blog', url: 'https://blog.ethereum.org/en/feed.xml', layer: 'B', source_type: 'primary', entity: 'Ethereum' },

  // --- GitHub release feedy protokolov (Layer B) ---
  { name: 'go-ethereum releases', url: 'https://github.com/ethereum/go-ethereum/releases.atom', layer: 'B', source_type: 'primary', entity: 'Ethereum' },
  { name: 'Bitcoin Core releases', url: 'https://github.com/bitcoin/bitcoin/releases.atom', layer: 'B', source_type: 'primary', entity: 'Bitcoin' },
  { name: 'Solana releases', url: 'https://github.com/solana-labs/solana/releases.atom', layer: 'B', source_type: 'primary', entity: 'Solana' },
  { name: 'Uniswap v3-core releases', url: 'https://github.com/Uniswap/v3-core/releases.atom', layer: 'B', source_type: 'primary', entity: 'Uniswap' },
  { name: 'Chainlink releases', url: 'https://github.com/smartcontractkit/chainlink/releases.atom', layer: 'B', source_type: 'primary', entity: 'Chainlink' },
  { name: 'Lighthouse (ETH consensus) releases', url: 'https://github.com/sigp/lighthouse/releases.atom', layer: 'B', source_type: 'primary', entity: 'Ethereum' },
];
