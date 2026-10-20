document.addEventListener('DOMContentLoaded', () => {
  const i18n = typeof browser !== 'undefined' ? browser.i18n : chrome.i18n;

  // 1. Traducir contenido de texto (textContent)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = i18n.getMessage(key);
    if (translation) el.textContent = translation;
  });

  // 2. Traducir Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translation = i18n.getMessage(key);
    if (translation) el.placeholder = translation;
  });

  // 3. Traducir Atributos 'title' (Tooltips)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translation = i18n.getMessage(key);
    if (translation) el.title = translation;
  });

  // 4. Traducir Atributos 'alt' en imágenes
  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    const key = el.getAttribute('data-i18n-alt');
    const translation = i18n.getMessage(key);
    if (translation) el.alt = translation;
  });
});
