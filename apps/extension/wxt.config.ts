import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "LinkWisp",
    description: "Create clean, shareable short links while keeping history on your device.",
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      96: "icon/96.png",
      128: "icon/128.png"
    },
    action: {
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png"
      }
    },
    permissions: ["activeTab", "storage", "contextMenus"],
    host_permissions: [
      "http://localhost:8787/*",
      "http://127.0.0.1:8787/*",
      "https://*.workers.dev/*"
    ],
    commands: {
      "shorten-current-tab": {
        suggested_key: {
          default: "Ctrl+Shift+S",
          mac: "Command+Shift+S"
        },
        description: "Shorten the current tab"
      }
    }
  }
});
