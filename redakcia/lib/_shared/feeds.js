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
  // Lido governance — VYHODENÉ 2026-08-02. Najhorší pomer v celom zozname:
  // 54 položiek, $0.303 na extrakciu, ANI JEDEN článok. Fórum rieši prevažne
  // interné parametre protokolu, ktoré neprejdú bránou dôležitosti.
  // { name: 'Lido governance', url: 'https://research.lido.fi/latest.rss', layer: 'C', source_type: 'primary', entity: 'Lido' },
  { name: 'Ethereum Magicians', url: 'https://ethereum-magicians.org/latest.rss', layer: 'C', source_type: 'primary', entity: 'Ethereum' },

  // --- Ekosystém (Layer B) ---
  { name: 'Solana news', url: 'https://solana.com/news/rss.xml', layer: 'B', source_type: 'primary', entity: 'Solana' },

  // ==========================================================
  // RESEARCH DESKY BÚRZ A ANALYTICKÝCH DOMOV (Layer C) — desk: true
  // ----------------------------------------------------------
  // PREČO (2026-08-01): dovtedy sme vedeli povedať LEN „čo sa stalo" (cena,
  // TVL, nálada) — žiadny zdroj nenosil „PREČO". Preto sa pohyby ceny ani
  // nepublikovali: bez príčiny je z toho holé číslo bez hodnoty.
  //
  // Tieto zdroje publikujú VLASTNÝ trhový komentár. Reportujeme fakt, ŽE to
  // tvrdia — teda „podľa Bitfinex Alpha…" — nikdy to nevydávame za svoj
  // záver. To je Model 2 (atribuovaná agregácia) z CLAUDE.md.
  //
  // desk: true je jediné, čo odomkne fakty kind="analysis" (viď 05-verification).
  // Bez tohto príznaku žiadny zdroj príčinu do článku nedostane.
  //
  // Overené 2026-08-01 (HTTP 200 + platný feed + čerstvosť). Nefungovali a preto
  // TU NIE SÚ: Coinbase (403), Glassnode (403), Messari/a16z/Paradigm/VanEck (404),
  // Binance Research (202), Grayscale (429), Bybit/Delphi (200 bez položiek).
  { name: 'Bitfinex Alpha', url: 'https://blog.bitfinex.com/feed/', layer: 'C', source_type: 'primary', entity: null, desk: true },
  { name: 'Kraken Intelligence', url: 'https://blog.kraken.com/feed', layer: 'C', source_type: 'primary', entity: null, desk: true },
  { name: 'Deribit Insights', url: 'https://insights.deribit.com/feed/', layer: 'C', source_type: 'primary', entity: null, desk: true },
  { name: 'BitMEX Research', url: 'https://blog.bitmex.com/feed/', layer: 'C', source_type: 'primary', entity: null, desk: true },
  { name: 'Chainalysis', url: 'https://www.chainalysis.com/blog/rss/', layer: 'C', source_type: 'primary', entity: null, desk: true },
  { name: 'CoinShares', url: 'https://blog.coinshares.com/feed', layer: 'C', source_type: 'primary', entity: null, desk: true },

  // ==========================================================
  // SEKCIA: AI (Umelá inteligencia) — section: 'ai'
  // Primárne oznámenia labov + oficiálne blogy + GitHub releases nástrojov.
  // Cross-topic feedy (NVIDIA, Google Research) → keywordFilter: true (pusti len AI témy).
  // ==========================================================
  // Oficiálne blogy labov (čisto AI → bez filtra)
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', layer: 'B', source_type: 'primary', entity: 'OpenAI', section: 'ai' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', layer: 'B', source_type: 'primary', entity: 'Google DeepMind', section: 'ai' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', layer: 'B', source_type: 'primary', entity: 'Google AI', section: 'ai' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', layer: 'B', source_type: 'primary', entity: 'Hugging Face', section: 'ai' },
  { name: 'Anthropic', url: 'https://tim-hilde.github.io/anthropic-rss/rss.xml', layer: 'B', source_type: 'primary', entity: 'Anthropic', section: 'ai' },

  // Cross-topic (majú aj ne-AI obsah) → keywordFilter
  { name: 'NVIDIA blog', url: 'https://blogs.nvidia.com/feed/', layer: 'B', source_type: 'primary', entity: null, section: 'ai', keywordFilter: true },
  { name: 'Google Research', url: 'https://research.google/blog/rss/', layer: 'B', source_type: 'primary', entity: null, section: 'ai', keywordFilter: true },

  // GitHub releases AI nástrojov/knižníc (Layer B) — rovnaký mechanizmus ako krypto
  { name: 'Hugging Face Transformers releases', url: 'https://github.com/huggingface/transformers/releases.atom', layer: 'B', source_type: 'primary', entity: 'Hugging Face', section: 'ai' },
  { name: 'vLLM releases', url: 'https://github.com/vllm-project/vllm/releases.atom', layer: 'B', source_type: 'primary', entity: 'vLLM', section: 'ai' },
  // llama.cpp releases — VYHODENÉ 2026-08-02. Release notes k verziám: článok
  // z toho vznikol ($0.111 / 9 položiek / 5 článkov), ale redakcia ich
  // sústavne zahadzovala. Platiť za obsah, ktorý sa aj tak nepoužije, nemá
  // zmysel. Vrátiť = odkomentovať riadok.
  // { name: 'llama.cpp releases', url: 'https://github.com/ggml-org/llama.cpp/releases.atom', layer: 'B', source_type: 'primary', entity: null, section: 'ai' },

  // Ďalší lab + robotika + startupy (čisto AI/robotika/startup obsah → bez filtra)
  { name: 'Mistral AI blog', url: 'https://mistral.ai/rss.xml', layer: 'B', source_type: 'primary', entity: 'Mistral AI', section: 'ai' },
  // Hugging Face LeRobot releases — VYHODENÉ 2026-08-02. 21 položiek, $0.171,
  // nula článkov. Release notes robotickej knižnice sú príliš úzka téma.
  // POZOR: hlavný blog Hugging Face (vyššie) ZOSTÁVA — ten dal 9 článkov
  // z 9 položiek za $0.016/kus a patrí k najlepším zdrojom vôbec.
  // { name: 'Hugging Face LeRobot releases', url: 'https://github.com/huggingface/lerobot/releases.atom', layer: 'B', source_type: 'primary', entity: 'Hugging Face', section: 'ai' },
  { name: 'Y Combinator blog', url: 'https://www.ycombinator.com/blog/rss', layer: 'B', source_type: 'primary', entity: null, section: 'ai' },

  // Cross-topic hardvér/firemné newsroomy (majú aj ne-AI obsah) → keywordFilter
  { name: 'Meta Newsroom', url: 'https://about.fb.com/news/feed/', layer: 'B', source_type: 'primary', entity: 'Meta', section: 'ai', keywordFilter: true },
  { name: 'Databricks blog', url: 'https://www.databricks.com/feed', layer: 'B', source_type: 'primary', entity: 'Databricks', section: 'ai', keywordFilter: true },
  { name: 'AMD press releases', url: 'https://ir.amd.com/rss/news-releases.xml', layer: 'B', source_type: 'primary', entity: 'AMD', section: 'ai', keywordFilter: true },
  { name: 'Apple Newsroom', url: 'https://www.apple.com/newsroom/rss-feed.rss', layer: 'B', source_type: 'primary', entity: 'Apple', section: 'ai', keywordFilter: true },
  { name: 'Raspberry Pi news', url: 'https://www.raspberrypi.com/news/feed/', layer: 'B', source_type: 'primary', entity: null, section: 'ai', keywordFilter: true },
  { name: 'Samsung Newsroom', url: 'https://news.samsung.com/global/feed', layer: 'B', source_type: 'primary', entity: 'Samsung', section: 'ai', keywordFilter: true },

  // Sekundárne recenzné médiá (AI hardvér/appky) — VŽDY s atribúciou "podľa X",
  // nikdy tichý prepis. attribution_required sa nastaví automaticky (05-verification).
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', layer: 'C', source_type: 'secondary', entity: null, section: 'ai', keywordFilter: true },
  { name: "Tom's Hardware", url: 'https://www.tomshardware.com/feeds.xml', layer: 'C', source_type: 'secondary', entity: null, section: 'ai', keywordFilter: true },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', layer: 'C', source_type: 'secondary', entity: null, section: 'ai', keywordFilter: true },

  // ==========================================================
  // SEKCIA: EKONOMIKA — section: 'ekonomika'
  // ----------------------------------------------------------
  // Overené 5. 9. 2026: HTTP 200 + platný RSS/Atom + čerstvé položky.
  //
  // SLOVENSKÝ PRIMÁRNY ZDROJ TU NIE JE, a nie je to prehliadnutie: ŠÚSR aj
  // OECD/IMF/BLS vracajú HTTP 403 spoza Akamai bot-ochrany aj s prehliadačovou
  // hlavičkou (teda by zlyhali aj serveru, nielen curlu), Ministerstvo financií
  // SR a World Bank nemajú nájditeľný RSS a Eurostat feed síce odpovedá 200, ale
  // je MŔTVY — posledná položka je z 30. 9. 2021. Slovenskú ekonomiku preto robí
  // redakcia ručne; táto sekcia pokrýva EÚ a svet.
  //
  // POZOR, TOTO NIE JE CELÝ PRÍBEH (doplnené 5. 9.): cez RSS a HTML sa k tým
  // dátam naozaj nedostaneme, ale OTVORENÉ API ŽIJÚ — data.statistics.sk/api/v2
  // (ŠÚSR, JSON-stat) aj Eurostat dissemination API vracajú 200. Tie sem nepatria,
  // lebo FEEDS je zoznam RSS/Atom zdrojov pre 01-scout; API by potreboval vlastný
  // typ zdroja (poller na zmenu poľa `update` + mapovanie JSON-stat na fakty
  // Layer A štýlom). Podrobnosti a caveaty v koreňovom CLAUDE.md.
  //
  // desk: true pri médiách je zovšeobecnenie pôvodného významu („research desk
  // búrzy") na „zdroj, ktorý smie niesť výklad". V ekonomike je tým výkladom
  // prognóza a očakávanie ekonómov — bez tohto príznaku by extraktor musel
  // zahodiť aj „ekonómovia čakali 130 000", čo je pritom jadro hospodárskej
  // správy. So source_type: 'secondary' k tomu automaticky patrí „podľa X".
  //
  // Zdroje BEZ filtra sú tematicky úzke už od vydavateľa (CNBC Economy, Euronews
  // Business, Fed monetary). Široké newsroomy majú keywordFilter → EKONOMIKA_RE.

  // Primárne inštitúcie
  { name: 'Európska komisia', url: 'https://ec.europa.eu/commission/presscorner/api/rss?to=xml', layer: 'C', source_type: 'primary', entity: null, section: 'ekonomika', keywordFilter: true },
  { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_monetary.xml', layer: 'C', source_type: 'primary', entity: 'Federal Reserve', section: 'ekonomika' },

  // Hospodárske médiá — VŽDY s atribúciou „podľa X" (source_type: 'secondary')
  { name: 'CNBC Economy', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', layer: 'C', source_type: 'secondary', entity: null, section: 'ekonomika', desk: true },
  { name: 'Euronews Business', url: 'https://www.euronews.com/rss?level=theme&name=business', layer: 'C', source_type: 'secondary', entity: null, section: 'ekonomika', desk: true },
  { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', layer: 'C', source_type: 'secondary', entity: null, section: 'ekonomika', desk: true, keywordFilter: true },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', layer: 'C', source_type: 'secondary', entity: null, section: 'ekonomika', desk: true, keywordFilter: true },

  // NEPRIDANÉ, overené a zamietnuté 5. 9. 2026 — nech to nikto neskúša znova:
  //   Štatistický úrad SR      HTTP 403 (Akamai, aj s prehliadačovou hlavičkou)
  //   US Bureau of Labor Stat. HTTP 403 (Akamai)
  //   OECD                     HTTP 403
  //   IMF                      HTTP 403 (Akamai)
  //   Ministerstvo financií SR HTTP 404, RSS sa nedá nájsť
  //   World Bank               HTTP 404
  //   Eurostat                 HTTP 200, ale mŕtvy feed (posledná položka 2021)
  //   Reuters                  verejné RSS zrušené ~2020: feeds.reuters.com je
  //                            mŕtve, reuters.com/*/rss vracia 401/404
  //   Investing.com            funguje, ale „All News" mieša ekonomiku s
  //                            rokovaniami o autonómnych zbraniach — šum, ktorý
  //                            by sme platili Haiku za extrakciu
  //   CNBC Top News            funguje, ale prekrýva sa s CNBC Economy a pridáva
  //                            netematický šum (akcie jednotlivých firiem)
  //   Financial Times          funguje a je čerstvý, ale je to celková
  //                            medzinárodná sekcia a plný text je za paywallom
];
