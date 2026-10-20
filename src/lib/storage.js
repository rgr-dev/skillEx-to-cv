/* Shared storage helpers. Loaded as a plain script (no ES modules) so it works
 * both in the background page and in regular extension pages via <script>. */
(function (global) {
  "use strict";

  const DEFAULT_CONFIG = {
    provider: "anthropic", // 'anthropic' | 'openai' | 'generic'
    apiKey: "",
    model: "",
    endpoint: "" // only used by 'generic' provider (OpenAI-compatible chat/completions endpoint)
  };

  const SUPPORTED_LANGS = ["es", "en", "pt"];

  async function getConfig() {
    const { aiConfig } = await browser.storage.local.get("aiConfig");
    return Object.assign({}, DEFAULT_CONFIG, aiConfig || {});
  }

  async function setConfig(partialConfig) {
    const current = await getConfig();
    const next = Object.assign({}, current, partialConfig);
    await browser.storage.local.set({ aiConfig: next });
    return next;
  }

  async function getCvMarkdownMap() {
    const { cvMarkdown } = await browser.storage.local.get("cvMarkdown");
    return cvMarkdown || {};
  }

  async function setCvMarkdown(lang, content) {
    const map = await getCvMarkdownMap();
    map[lang] = content;
    await browser.storage.local.set({ cvMarkdown: map });
    return map;
  }

  async function ensureDefaultCvMarkdownSeeded() {
    const map = await getCvMarkdownMap();
    const missing = SUPPORTED_LANGS.filter((lang) => !map[lang]);
    if (missing.length === 0) return map;

    for (const lang of missing) {
      try {
        const url = browser.runtime.getURL(`cv-master.${lang}.md`);
        const res = await fetch(url);
        if (res.ok) {
          map[lang] = await res.text();
        }
      } catch (err) {
        console.error(`SkillEx: was not possible to load cv-master.${lang}.md`, err);
      }
    }
    await browser.storage.local.set({ cvMarkdown: map });
    return map;
  }

  async function setPendingSelection(selectionText, sourceUrl) {
    await browser.storage.local.set({
      pendingSelection: {
        text: selectionText,
        sourceUrl: sourceUrl || "",
        createdAt: Date.now()
      }
    });
  }

  async function getPendingSelection() {
    const { pendingSelection } = await browser.storage.local.get("pendingSelection");
    return pendingSelection || null;
  }

  async function getApplicationsHistory() {
    const { applicationsHistory } = await browser.storage.local.get("applicationsHistory");
    return Array.isArray(applicationsHistory) ? applicationsHistory : [];
  }

  async function saveApplication(appData) {
    const list = await getApplicationsHistory();
    const id = appData.id || `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = Object.assign({}, appData, {
      id,
      updatedAt: new Date().toISOString(),
      createdAt: appData.createdAt || new Date().toISOString()
    });

    const existingIndex = list.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.unshift(record); // newer first
    }

    await browser.storage.local.set({ applicationsHistory: list });
    return record;
  }

  async function deleteApplication(id) {
    const list = await getApplicationsHistory();
    const nextList = list.filter((item) => item.id !== id);
    await browser.storage.local.set({ applicationsHistory: nextList });
    return nextList;
  }

  async function clearApplicationsHistory() {
    await browser.storage.local.set({ applicationsHistory: [] });
    return [];
  }

  global.SkillExStorage = {
    SUPPORTED_LANGS,
    DEFAULT_CONFIG,
    getConfig,
    setConfig,
    getCvMarkdownMap,
    setCvMarkdown,
    ensureDefaultCvMarkdownSeeded,
    setPendingSelection,
    getPendingSelection,
    getApplicationsHistory,
    saveApplication,
    deleteApplication,
    clearApplicationsHistory
  };
})(typeof window !== "undefined" ? window : self);
