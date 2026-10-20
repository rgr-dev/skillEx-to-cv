"use strict";

const MENU_ID = "skillex-generate-cv";

browser.runtime.onInstalled.addListener(async () => {
  await SkillExStorage.ensureDefaultCvMarkdownSeeded();
});

browser.contextMenus.create({
  id: MENU_ID,
  title: 'Generar CV con estas skills ("%s")',
  contexts: ["selection"]
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const selectionText = (info.selectionText || "").trim();
  if (!selectionText) return;

  await SkillExStorage.setPendingSelection(selectionText, tab ? tab.url : "");

  await browser.tabs.create({
    url: browser.runtime.getURL("src/review/review.html")
  });
});
