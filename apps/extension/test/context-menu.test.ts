import { describe, expect, it, vi } from "vitest";
import {
  registerContextMenu,
  SHORTEN_CONTEXT_MENU_ID
} from "../lib/context-menu";

describe("registerContextMenu", () => {
  it("can run repeatedly without leaving a duplicate menu ID", async () => {
    const items = new Set<string>();
    const removeAll = vi.fn(async () => {
      items.clear();
    });
    const create = vi.fn((details: {
      id: string;
      title: string;
      contexts: ["page"];
    }) => {
      if (items.has(details.id)) throw new Error(`duplicate id ${details.id}`);
      items.add(details.id);
    });

    await registerContextMenu({ removeAll, create });
    await registerContextMenu({ removeAll, create });

    expect([...items]).toEqual([SHORTEN_CONTEXT_MENU_ID]);
    expect(removeAll).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith({
      id: SHORTEN_CONTEXT_MENU_ID,
      title: "Shorten this page",
      contexts: ["page"]
    });
  });

  it("does not create a menu when cleanup fails", async () => {
    const create = vi.fn();

    await expect(registerContextMenu({
      removeAll: vi.fn().mockRejectedValue(new Error("cleanup failed")),
      create
    })).rejects.toThrow("cleanup failed");
    expect(create).not.toHaveBeenCalled();
  });
});
