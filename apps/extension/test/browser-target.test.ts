import { describe, expect, it, vi } from "vitest";
import {
  browserSpecificManifest,
  FIREFOX_EXTENSION_ID,
  FIREFOX_MIN_VERSION,
  openExtensionPopup
} from "../lib/browser-target";

describe("browser-specific manifest", () => {
  it("keeps the named Chrome command", () => {
    const manifest = browserSpecificManifest("chrome");

    expect(manifest).toEqual({
      commands: {
        "shorten-current-tab": {
          suggested_key: {
            default: "Ctrl+Shift+S",
            mac: "Command+Shift+S"
          },
          description: "Shorten the current tab"
        }
      }
    });
  });

  it("uses Firefox's Manifest V2 action command and a stable add-on ID", () => {
    const manifest = browserSpecificManifest("firefox");

    expect(manifest).toEqual({
      browser_specific_settings: {
        gecko: {
          id: FIREFOX_EXTENSION_ID,
          strict_min_version: FIREFOX_MIN_VERSION,
          data_collection_permissions: {
            required: ["authenticationInfo", "browsingActivity"],
            optional: ["technicalAndInteraction"]
          }
        },
        gecko_android: {
          strict_min_version: "142.0"
        }
      },
      commands: {
        _execute_browser_action: {
          suggested_key: {
            default: "Ctrl+Shift+S",
            mac: "Command+Shift+S"
          }
        }
      }
    });
  });
});

describe("popup API routing", () => {
  it("uses browserAction for Manifest V2", async () => {
    const manifestV2 = vi.fn().mockResolvedValue(undefined);
    const manifestV3 = vi.fn().mockResolvedValue(undefined);

    await openExtensionPopup(2, { manifestV2, manifestV3 });

    expect(manifestV2).toHaveBeenCalledOnce();
    expect(manifestV3).not.toHaveBeenCalled();
  });

  it("uses action for Manifest V3", async () => {
    const manifestV2 = vi.fn().mockResolvedValue(undefined);
    const manifestV3 = vi.fn().mockResolvedValue(undefined);

    await openExtensionPopup(3, { manifestV2, manifestV3 });

    expect(manifestV3).toHaveBeenCalledOnce();
    expect(manifestV2).not.toHaveBeenCalled();
  });
});
