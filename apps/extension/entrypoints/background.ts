export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "shorten-current-page",
      title: "Shorten this page",
      contexts: ["page"]
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "shorten-current-page" || !tab?.url) return;
    await browser.storage.session.set({ pendingDestination: tab.url });
    await browser.action.openPopup();
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== "shorten-current-tab" || !tab?.url) return;
    await browser.storage.session.set({ pendingDestination: tab.url });
    await browser.action.openPopup();
  });
});

