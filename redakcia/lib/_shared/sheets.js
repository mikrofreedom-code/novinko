// GOOGLE SHEETS — zápis článku do existujúceho Novinko (živá stránka).
// Rovnaký formát ako generate-krypto v novinko-clean: hárok "articles", stĺpce A:H.
// Zámerne ŽIADNE čítanie/miešanie s pipeline Supabase — len zápis riadku.
import jwt from 'jsonwebtoken';

const PARAGRAPH_DELIM = '¶¶'; // tak ako to číta clanok.html na stránke

export async function getAccessToken() {
  const auth = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      iss: auth.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, iat: now,
    },
    auth.private_key,
    { algorithm: 'RS256' },
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${token}`,
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`Google token zlyhal: ${JSON.stringify(j).slice(0, 150)}`);
  return j.access_token;
}

// Odseky do jednej bunky (¶¶), nech ich clanok.html vie rozdeliť späť.
function paragraphsToCell(body) {
  return String(body || '')
    .split(/\n{2,}/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
    .join(` ${PARAGRAPH_DELIM} `);
}

let _counter = 0;
function uniqueId() { _counter += 1; return `${Date.now()}${String(_counter).padStart(2, '0')}`; }

// Z nášho article objektu poskladá riadok A:H pre Sheet.
// category: 'krypto' (default) alebo napr. 'krypto-skola' pre evergreen sekciu.
export function articleToRow(article, category = 'krypto') {
  const first = (article.sources ?? [])[0] ?? {};
  return [
    uniqueId(),                                   // A: ID
    article.headline,                             // B: titulok
    article.perex || '',                          // C: perex
    paragraphsToCell(article.body),               // D: telo (¶¶)
    `${first.name ?? '—'} | ${first.url ?? ''}`,  // E: zdroj | link
    new Date().toISOString(),                     // F: dátum zverejnenia (ako generate-krypto)
    article.category || category,                 // G: kategória
    article.image_url || '',                      // H: obrázok
    article.image_credit || '',                   // I: zdroj obrázka (autor/agentúra)
  ];
}

// Zapíše riadok do hárku "articles".
export async function appendArticleRow(row) {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error('chýba GOOGLE_SHEETS_ID');
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/articles!A:I:append`
            + `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) throw new Error(`Sheets append ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
