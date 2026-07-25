export const FIREFOX_MIN_VERSION = "140.0";
export const FIREFOX_EXTENSION_ID = "linkwisp@amr-m-alshameeri";

const shortcut = {
  suggested_key: {
    default: "Ctrl+Shift+S",
    mac: "Command+Shift+S"
  }
};

export function browserSpecificManifest(browserName: string) {
  if (browserName === "firefox") {
    return {
      browser_specific_settings: {
        gecko: {
          id: FIREFOX_EXTENSION_ID,
          strict_min_version: FIREFOX_MIN_VERSION,
          data_collection_permissions: {
            required: ["authenticationInfo", "browsingActivity"]
          }
        },
        gecko_android: {
          strict_min_version: "142.0"
        }
      },
      commands: {
        _execute_browser_action: shortcut
      }
    };
  }

  return {
    commands: {
      "shorten-current-tab": {
        ...shortcut,
        description: "Shorten the current tab"
      }
    }
  };
}

interface PopupOpeners {
  manifestV2: () => Promise<void>;
  manifestV3: () => Promise<void>;
}

export function openExtensionPopup(
  manifestVersion: number,
  openers: PopupOpeners
): Promise<void> {
  return manifestVersion === 2
    ? openers.manifestV2()
    : openers.manifestV3();
}
