export const SHORTEN_CONTEXT_MENU_ID = "shorten-current-page";

interface ContextMenuRegistrationApi {
  removeAll(): Promise<void>;
  create(details: {
    id: string;
    title: string;
    contexts: ["page"];
  }): void;
}

export async function registerContextMenu(
  contextMenus: ContextMenuRegistrationApi
): Promise<void> {
  await contextMenus.removeAll();
  contextMenus.create({
    id: SHORTEN_CONTEXT_MENU_ID,
    title: "Shorten this page",
    contexts: ["page"]
  });
}
