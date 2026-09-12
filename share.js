// Kopírovanie odkazu na tlačidle "Zdieľať" pod článkom.
//
// PREČO EXTERNÝ SÚBOR, NIE INLINE <script>: /clanok/<slug>-<id> skladá
// netlify/functions/clanok.js ZA BEHU (nie je súčasť statického _site/).
// scripts/gen-csp.mjs počíta SHA-256 hashe inline skriptov len z HTML
// súborov v _site/ pri builde — skript, ktorý vznikne až pri požiadavke,
// by nemal zodpovedajúci hash a CSP by ho zablokovala. Externý súbor s
// `src` sedí pod "script-src 'self'" bez ohľadu na to, ktorá stránka ho
// volá (funkcia aj statické HTML).
//
// Event delegácia na document — funguje bez ohľadu na to, kedy/ako sa
// tlačidlo .share-copy objaví v DOM (clanok.html si obsah skladá až po
// načítaní CSV).
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.share-copy');
  if (!btn) return;
  var url = btn.getAttribute('data-share-url');
  if (!url || !navigator.clipboard || !navigator.clipboard.writeText) return;

  navigator.clipboard.writeText(url).then(function () {
    var povodny = btn.getAttribute('aria-label');
    btn.classList.add('share-copy-ok');
    btn.setAttribute('aria-label', 'Odkaz skopírovaný');
    setTimeout(function () {
      btn.classList.remove('share-copy-ok');
      btn.setAttribute('aria-label', povodny);
    }, 1800);
  }).catch(function () { /* ticho zlyhá — tlačidlá na zdieľanie fungujú ďalej */ });
});
