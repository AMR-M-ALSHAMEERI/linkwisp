import {
  registerContextMenu,
  SHORTEN_CONTEXT_MENU_ID
} from "../lib/context-menu";
import { openExtensionPopup } from "../lib/browser-target";

function openPopup(): Promise<void> {
  const firefoxBrowserAction = browser.browserAction as typeof browser.browserAction & {
    openPopup: () => Promise<void>;
  };

  return openExtensionPopup(import.meta.env.MANIFEST_VERSION, {
    manifestV2: () => firefoxBrowserAction.openPopup(),
    manifestV3: () => browser.action.openPopup()
  });
}

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
    await openPopup();
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== "shorten-current-tab" || !tab?.url) return;
    await browser.storage.session.set({ pendingDestination: tab.url });
    await openPopup();
  });
});

