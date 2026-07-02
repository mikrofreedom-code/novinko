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

  // --- Regulátori / centrálne banky (Layer C) ---
  // Píšu väčšinou NEkrypto obsah → cryptoFilter: true (brána pustí len krypto témy).
  // entity: null → presnú entitu + typ ('regulatory') určí 05 z textu.
  { name: 'SEC press releases', url: 'https://www.sec.gov/news/pressreleases.rss', layer: 'C', source_type: 'primary', entity: null, cryptoFilter: true },
  { name: 'ESMA news', url: 'https://www.esma.europa.eu/rss.xml', layer: 'C', source_type: 'primary', entity: null, cryptoFilter: true },
  { name: 'ECB press', url: 'https://www.ecb.europa.eu/rss/press.xml', layer: 'C', source_type: 'primary', entity: null, cryptoFilter: true },
  { name: 'FCA (UK)', url: 'https://www.fca.org.uk/news/rss.xml', layer: 'C', source_type: 'primary', entity: null, cryptoFilter: true },
  { name: 'NBS (Slovensko)', url: 'https://nbs.sk/en/feed/', layer: 'C', source_type: 'primary', entity: null, cryptoFilter: true },

  // --- Krypto PR wire (Layer C) — tlačové správy projektov, určené na šírenie ---
  { name: 'Chainwire (krypto PR)', url: 'https://chainwire.org/feed/', layer: 'C', source_type: 'primary', entity: null },

  // --- Governance fóra projektov (Layer C) — oficiálne návrhy/rozhodnutia DAO ---
  { name: 'Uniswap governance', url: 'https://gov.uniswap.org/latest.rss', layer: 'C', source_type: 'primary', entity: 'Uniswap' },
  { name: 'Aave governance', url: 'https://governance.aave.com/latest.rss', layer: 'C', source_type: 'primary', entity: 'Aave' },
  { name: 'Optimism governance', url: 'https://gov.optimism.io/latest.rss', layer: 'C', source_type: 'primary', entity: 'Optimism' },
  { name: 'Arbitrum governance', url: 'https://forum.arbitrum.foundation/latest.rss', layer: 'C', source_type: 'primary', entity: 'Arbitrum' },
  { name: 'Lido governance', url: 'https://research.lido.fi/latest.rss', layer: 'C', source_type: 'primary', entity: 'Lido' },
  { name: 'MakerDAO governance', url: 'https://forum.makerdao.com/latest.rss', layer: 'C', source_type: 'primary', entity: 'Maker' },

  // --- Ekosystém (Layer B) ---
  { name: 'Solana news', url: 'https://solana.com/news/rss.xml', layer: 'B', source_type: 'primary', entity: 'Solana' },

  // ==========================================================
  // SEKCIA: AI (Umelá inteligencia) — section: 'ai'
  // Primárne oznámenia labov + oficiálne blogy + GitHub releases nástrojov.
  // Cross-topic feedy (NVIDIA, Google Research) → keywordFilter: true (pusti len AI témy).
  // ==========================================================
  // Oficiálne blogy labov (čisto AI → bez filtra)
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', layer: 'B', source_type: 'primary', entity: 'OpenAI', section: 'ai' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', layer: 'B', source_type: 'primary', entity: 'Google DeepMind', section: 'ai' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', layer: 'B', source_type: 'primary', entity: 'Hugging Face', section: 'ai' },
  { name: 'Anthropic', url: 'https://tim-hilde.github.io/anthropic-rss/rss.xml', layer: 'B', source_type: 'primary', entity: 'Anthropic', section: 'ai' },

  // Cross-topic (majú aj ne-AI obsah) → keywordFilter
  { name: 'NVIDIA blog', url: 'https://blogs.nvidia.com/feed/', layer: 'B', source_type: 'primary', entity: null, section: 'ai', keywordFilter: true },
  { name: 'Google Research', url: 'https://research.google/blog/rss/', layer: 'B', source_type: 'primary', entity: null, section: 'ai', keywordFilter: true },

  // GitHub releases AI nástrojov/knižníc (Layer B) — rovnaký mechanizmus ako krypto
  { name: 'Hugging Face Transformers releases', url: 'https://github.com/huggingface/transformers/releases.atom', layer: 'B', source_type: 'primary', entity: 'Hugging Face', section: 'ai' },
  { name: 'vLLM releases', url: 'https://github.com/vllm-project/vllm/releases.atom', layer: 'B', source_type: 'primary', entity: 'vLLM', section: 'ai' },
  { name: 'llama.cpp releases', url: 'https://github.com/ggml-org/llama.cpp/releases.atom', layer: 'B', source_type: 'primary', entity: null, section: 'ai' },
];
