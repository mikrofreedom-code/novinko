// Rovnaké spracovanie zdrojov vo formulári aj pri čítaní starších článkov.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NovinkoSources = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function validUrl(value) {
    if (typeof value !== 'string' || /\s/.test(value) || (value.match(/https?:\/\//gi) || []).length !== 1) return false;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }

  function lines(text) {
    return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  function stripNumber(value) {
    return value.replace(/^(?:\[\d+\]|\d+[.)])\s*/, '').trim();
  }

  function parse(namesText, urlsText) {
    const nameLines = lines(namesText);
    const urlLines = lines(urlsText);
    for (const entries of [nameLines, urlLines]) entries.forEach((entry, i) => {
      const number = entry.match(/^(?:\[(\d+)\]|(\d+)[.)])\s*/);
      if (number && Number(number[1] || number[2]) !== i + 1) throw new Error('Číslovanie zdrojov musí ísť postupne od [1] a zhodovať sa pri názvoch aj URL.');
    });
    const names = nameLines.map(stripNumber);
    const urls = urlLines.map(stripNumber);
    if (!urls.length || urls.length > 12) throw new Error('Zadaj 1 až 12 URL zdrojov, každú na samostatný riadok.');
    if (names.length !== urls.length || names.some(name => !name)) throw new Error('Počet názvov a URL musí byť rovnaký. Každý zdroj zadaj na samostatný riadok v rovnakom poradí.');
    return urls.map((url, i) => {
      if (!validUrl(url)) throw new Error(`Zdroj ${i + 1}: zadaj jednu platnú URL na riadok (http alebo https).`);
      if (names[i].length > 160 || url.length > 1000) throw new Error(`Zdroj ${i + 1}: názov môže mať najviac 160 znakov a URL 1 000 znakov.`);
      return { name: names[i], url };
    });
  }

  // Starý formulár ukladal všetky adresy do jedného reťazca. Pri čítaní ich
  // rozdelíme; chýbajúce/orezané názvy nedomýšľame, použijeme doménu.
  function normalize(sources) {
    return (Array.isArray(sources) ? sources : []).flatMap(source => {
      const rawUrl = String(source?.url || '').trim();
      const rawName = String(source?.name || '').trim();
      if (validUrl(rawUrl)) return [{ name: rawName || new URL(rawUrl).hostname, url: rawUrl }];
      const urls = rawUrl.split(/\s+/).map(stripNumber).filter(validUrl);
      const names = rawName.split(/\[\d+\]\s*/).map(name => name.trim()).filter(Boolean);
      return urls.map((url, i) => ({
        name: names.length === urls.length || (/^\[1\]/.test(rawName) && i < names.length - 1)
          ? names[i] : new URL(url).hostname.replace(/^www\./, ''), url,
      }));
    });
  }

  function fill(form, sources) {
    const normalized = normalize(sources);
    form.elements.sourceNames.value = normalized.map(source => source.name).join('\n');
    form.elements.sourceUrls.value = normalized.map(source => source.url).join('\n');
  }

  return { validUrl, parse, normalize, fill };
});
