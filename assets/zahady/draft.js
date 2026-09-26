// Import konceptov vyplní výhradne obsahové polia. Nikdy nespúšťa publikovanie.
(() => {
  const input = document.getElementById('draftFile');
  const form = document.getElementById('f');
  const fields = ['headline','perex','text','category','subcategory','contentType','series','canonicalTopic','topicAliases','newAngleReason','country','location','historicalPeriod','persons','mainEntities','imageKind','seoTitle','metaDescription','focusKeyword','secondaryKeywords','tags','imageUrl','imageCredit'];
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const status = document.getElementById('status');
    try {
      if (file.size > 1024 * 1024) throw new Error('Koncept je príliš veľký (maximum 1 MB).');
      const draft = JSON.parse(await file.text());
      if (!draft || draft.format !== 'novinko-manual-draft-v1' || draft.category !== 'zahady') throw new Error('Vyber koncept rubriky Záhady a fenomény vo formáte Novinko.');
      for (const key of fields) {
        if (draft[key] != null && typeof draft[key] !== 'string') throw new Error(`Neplatné pole konceptu: ${key}`);
        const control = form.elements[key];
        if (control instanceof HTMLSelectElement && draft[key] && ![...control.options].some((o) => o.value === draft[key])) throw new Error(`Neplatná hodnota: ${key}`);
      }
      if (!draft.headline?.trim() || !draft.text?.trim() || !draft.perex?.trim()) throw new Error('Koncept potrebuje titulok, perex a text.');
      if (!Array.isArray(draft.sources) || !draft.sources.length || draft.sources.length > 12 || draft.sources.some((s) => !s || typeof s.name !== 'string' || typeof s.url !== 'string' || !/^https?:\/\//.test(s.url) || /[\r\n|]/.test(s.name + s.url))) throw new Error('Koncept obsahuje neplatné zdroje.');
      if ((form.elements.headline.value.trim() || form.elements.text.value.trim()) && !confirm('Nahradiť rozpracovaný text načítaným konceptom?')) return;
      // Reset clears an old article ID, scheduled time, photo and AI-generation settings.
      form.reset();
      for (const key of fields) if (form.elements[key]) form.elements[key].value = draft[key] || '';
      form.elements.sourcesText.value = draft.sources.map((s) => `${s.name} | ${s.url}`).join('\n');
      form.elements.category.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('preview').style.display = 'none';
      status.className = 'ok';
      status.textContent = 'Koncept je načítaný. Skontroluj obsah a obrázok. Zverejní sa až po zadaní hesla a kliknutí na Publikovať.';
    } catch (e) {
      status.className = 'err'; status.textContent = e instanceof SyntaxError ? 'Súbor neobsahuje platný JSON.' : e.message;
    } finally { input.value = ''; }
  });
})();
