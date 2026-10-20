(function (global) {
  "use strict";

  // Secure detection of API i18n (Firefox / Chrome)
  const i18nApi = typeof browser !== "undefined" && browser.i18n
    ? browser.i18n
    : (typeof chrome !== "undefined" && chrome.i18n ? chrome.i18n : null);

  /**
   * Wrapper global para obtener mensajes i18n con soporte para sustituciones.
   * Global wrapper used for getting message. Comes with sustitution support
   * @param {string} key - messaje key (in messages.json)
   * @param {string|string[]} [substitutions] - dynamic vars ($1, $2, etc.)
   * @returns {string}
   */
  function getMessage(key, substitutions) {
    if (i18nApi && typeof i18nApi.getMessage === "function") {
      const msg = i18nApi.getMessage(key, substitutions);
      if (msg) return msg;
    }
    return key;
  }

  global.getMessage = getMessage;
})(typeof window !== "undefined" ? window : self);
