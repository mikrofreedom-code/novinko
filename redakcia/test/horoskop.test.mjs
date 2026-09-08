import test from 'node:test';
import assert from 'node:assert/strict';

// Flow importuje queue klienta, ale tieto testy používajú iba čisté funkcie a
// nesmú sa pripájať na produkciu. Falošná lokálna URL stačí na inicializáciu.
process.env.SUPABASE_URL ??= 'http://127.0.0.1:1';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-only-key';

const {
  dayKey,
  fallbackSeed,
  jePlatnaPolozka,
  jePlatnyHoroskop,
  napisHoroskop,
} = await import('../lib/flow/16-horoskop.js');

test('dayKey používa lokálny kalendárny dátum', () => {
  assert.equal(dayKey(new Date(2026, 8, 9, 0, 15)), '2026-09-09');
});

test('fallback je stabilný v ten istý deň a mení sa ďalší deň', () => {
  const dnes = new Date(2026, 8, 9, 12);
  const zajtra = new Date(2026, 8, 10, 12);
  assert.equal(fallbackSeed(dnes, '♈ Baran'), fallbackSeed(dnes, '♈ Baran'));
  assert.notEqual(fallbackSeed(dnes, '♈ Baran'), fallbackSeed(zajtra, '♈ Baran'));
});

test('nebezpečný alebo zle formátovaný AI výstup sa nesmie použiť', () => {
  const bezpecne = {
    nazov: '♈ Baran',
    atmosfera: 'Dnešok môže priať pokojnému rozhodovaniu.',
    laska: '⭐⭐⭐☆☆ — Otvorený rozhovor môže pomôcť.',
    praca: '⭐⭐⭐⭐☆ — Sústreďte sa na jednu prioritu.',
    energia: '⭐⭐⭐☆☆ — Krátka prestávka padne vhod.',
    rada: 'Neponáhľajte sa s odpoveďou.',
  };
  assert.equal(jePlatnaPolozka(bezpecne), true);
  assert.equal(jePlatnaPolozka({ ...bezpecne, atmosfera: 'Určite sa stane nehoda.' }), false);
  assert.equal(jePlatnaPolozka({ ...bezpecne, laska: 'veľmi dobrá' }), false);
});

test('bez AI vznikne kompletný a dátumovo obmieňaný horoskop', async () => {
  const povodne = process.env.AI_ENABLED;
  process.env.AI_ENABLED = 'false';
  try {
    const dnes = await napisHoroskop(new Date(2026, 8, 9, 12));
    const zajtra = await napisHoroskop(new Date(2026, 8, 10, 12));
    assert.equal(dnes.generation_meta.fallback_count, 12);
    assert.equal(jePlatnyHoroskop(dnes, '2026-09-09'), true);
    assert.match(dnes.image_url, /horoskop-zverokruh\.webp$/);
    assert.notEqual(dnes.body, zajtra.body);
  } finally {
    if (povodne === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = povodne;
  }
});
