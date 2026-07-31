// ============================================================
// 09. Legal
// ------------------------------------------------------------
// ROLA:          Posledná brána pred publikovaním. Checklist bez AI:
//                je atribúcia tam, kde ju vyžadujú fakty? nie sú v texte
//                investičné odporúčania? nie je prevzatá citácia pridlhá?
//                má článok zdroje?
// VSTUP status:  proofed
// VÝSTUP status: legal_ok
// STAV:          🟢 MVP (rule-based)
// AI vrstva:     0 žiadna — celá kontrola je zadarmo
// ------------------------------------------------------------
// PREČO JE TVRDÁ: porušenie atribúcie alebo investičné poradenstvo nie je
// štylistická chyba, ktorú by sa oplatilo prepisovať. Článok, ktorý neprejde,
// ide do 'rejected' s presným dôvodom — nepokračuje na obrázok ani publish.
//
// Zdroj pravidiel: novinko pravidla/07_Autorske_prava_a_politika_citacii,
// 04_AI_Editorial_Constitution, 02_Eticky_kodex + Sourcing model v CLAUDE.md.
//
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

import { claim, advance } from '../_shared/queue.js';

export const STAGE = {
  index: 9,
  name: "Legal",
  input: "proofed",
  output: "legal_ok",
};

const AGENT = '09-legal';

// Maximálna dĺžka doslovnej citácie zo sekundárneho zdroja (fair use).
const MAX_QUOTE_CHARS = Number(process.env.LEGAL_MAX_QUOTE_CHARS ?? 300);

// Investičné odporúčania — nesmieme ich vydávať (nie sme licencovaní).
// Cieľ je VÝZVA čitateľovi ku konaniu, nie opis diania na trhu.
const ADVICE_RE = /\b(odpor[uú]čame|radíme vám|mali by ste (kúpiť|predať|investovať)|(kúpte|predajte|investujte|nakúpte)\s|(určite|rozhodne)\s+(kúpte|investujte)|garantovan[ýé]\s+(zisk|výnos)|istý\s+zisk|nenechajte si ujsť príležitosť|teraz je čas (kúpiť|nakúpiť))/i;

// Zoznam kontrol. Každá vráti null (ok) alebo text dôvodu (zamietnuté).
const CHECKS = [
  {
    id: 'zdroje',
    run: ({ article }) => {
      const s = article.sources ?? [];
      if (s.length === 0) return 'článok nemá ani jeden zdroj';
      const bezMena = s.filter((x) => !x?.name).length;
      if (bezMena > 0) return `${bezMena} zdroj(ov) bez názvu`;
      return null;
    },
  },
  {
    id: 'atribúcia',
    run: ({ article, facts }) => {
      // Ak ktorýkoľvek fakt pochádza zo sekundárneho média, text MUSÍ povedať „podľa X".
      if (facts?.attribution_required !== true) return null;
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      if (!/\bpodľa\b/i.test(body)) return 'fakty vyžadujú atribúciu, ale v texte nie je „podľa …"';
      // Aspoň jeden sekundárny zdroj musí byť v texte menovaný.
      const sekundarne = (article.sources ?? []).filter((s) => s.type === 'secondary');
      if (sekundarne.length === 0) return null;   // nič sekundárne → stačí samotné „podľa"
      const menovany = sekundarne.some((s) => s.name && body.includes(s.name));
      if (!menovany) {
        return `sekundárny zdroj nie je v texte menovaný (${sekundarne.map((s) => s.name).join(', ')})`;
      }
      return null;
    },
  },
  {
    id: 'citácie',
    run: ({ facts }) => {
      const dlhe = (facts?.facts ?? []).filter(
        (f) => f.kind === 'quote' && String(f.statement ?? '').length > MAX_QUOTE_CHARS,
      );
      if (dlhe.length) return `citácia dlhšia než ${MAX_QUOTE_CHARS} znakov (${dlhe.length}×) — nad rámec fair use`;
      return null;
    },
  },
  {
    id: 'investičné-poradenstvo',
    run: ({ article }) => {
      const body = `${article.headline} ${article.perex ?? ''} ${article.body}`;
      const hit = body.match(ADVICE_RE);
      if (hit) return `text obsahuje investičné odporúčanie: „${hit[0]}"`;
      return null;
    },
  },
];

// ---------- Spracuj JEDEN článok ----------
// dryRun: prebehne checklist a vráti výsledok, ale NEZAPÍŠE do fronty.
export async function run(item, { dryRun = false } = {}) {
  const article = item.article;
  if (!article?.headline || !article?.body) {
    throw new Error('item.article chýba headline/body');
  }
  const ctx = { article, facts: item.facts ?? {} };

  const problemy = [];
  for (const check of CHECKS) {
    const dovod = check.run(ctx);
    if (dovod) problemy.push(`${check.id}: ${dovod}`);
  }

  if (problemy.length) {
    if (!dryRun) await advance(item.id, 'rejected', { error: `${AGENT}: ${problemy.join(' | ')}` });
    return { ok: false, problemy };
  }

  const checked = {
    ...article,
    legal: { passed: CHECKS.map((c) => c.id), at: new Date().toISOString() },
  };
  if (!dryRun) await advance(item.id, STAGE.output, { article: checked });
  return { ok: true, problemy: [] };
}

// ---------- Dávka ----------
export async function runBatch(limit = 30) {
  const items = await claim(STAGE.input, limit);
  const res = { ok: 0, zamietnute: 0, failed: 0 };
  for (const item of items) {
    try {
      const r = await run(item);
      if (r.ok) res.ok++; else res.zamietnute++;
    } catch (err) {
      res.failed++;
      await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return res;
}
