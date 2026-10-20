(function () {
  'use strict';
  const field = document.getElementById('textField');
  const button = document.getElementById('insertLinkBtn');
  const dialog = document.getElementById('articleLinkDialog');
  const form = document.getElementById('articleLinkForm');
  const label = document.getElementById('articleLinkLabel');
  const url = document.getElementById('articleLinkUrl');
  const error = document.getElementById('articleLinkError');
  let start = 0, end = 0, leading = '', trailing = '';

  button.addEventListener('click', () => {
    start = field.selectionStart; end = field.selectionEnd;
    const selected = field.value.slice(start, end);
    leading = selected.match(/^\s*/)[0];
    trailing = selected.trim() ? selected.match(/\s*$/)[0] : '';
    label.value = selected.trim();
    url.value = NovinkoLinks.normalizeUrl(label.value) || '';
    error.textContent = '';
    dialog.showModal();
    (label.value ? url : label).focus();
  });

  document.getElementById('articleLinkCancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => field.focus());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const markup = NovinkoLinks.linkMarkup(label.value, url.value);
      field.setRangeText(leading + markup + trailing, start, end, 'end');
      field.dispatchEvent(new Event('input', { bubbles: true }));
      dialog.close();
    } catch (e) {
      error.textContent = e.message;
      url.focus();
    }
  });
})();
