import {
  registerContextMenu,
  SHORTEN_CONTEXT_MENU_ID
} from "../lib/context-menu";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void registerContextMenu({
      removeAll: () => browser.contextMenus.removeAll(),
      create: (details) => {
        browser.contextMenus.create(details);
      }
    }).catch((error: unknown) => {
      console.error(JSON.stringify({
        message: "context menu registration failed",
        error: error instanceof Error ? error.message : String(error)
      }));
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== SHORTEN_CONTEXT_MENU_ID || !tab?.url) return;
    await browser.storage.session.set({ pendingDestination: tab.url });
    await browser.action.openPopup();
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== "shorten-current-tab" || !tab?.url) return;
    await browser.storage.session.set({ pendingDestination: tab.url });
    await browser.action.openPopup();
  });
});

