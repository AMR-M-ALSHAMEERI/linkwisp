# Install from a GitHub Release

This guide is for users who do not need to read or build the source code.

> The first release ZIP has not been published yet. These are the installation steps the release will use.

## Chrome and Chromium browsers

1. Download `linkwisp-chrome-vX.Y.Z.zip` from the repository's **Releases** page.
2. Extract the ZIP into a permanent folder such as `Documents/Browser Extensions/LinkWisp`.
3. Open Chrome and enter `chrome://extensions` in the address bar.
4. Enable **Developer mode** in the upper-right corner.
5. Select **Load unpacked**.
6. Select the extracted extension folder—the folder containing `manifest.json`.
7. Pin the extension from Chrome's Extensions menu.
8. Open the extension and enter the service address and access code provided by the service owner.

Do not delete or move the extracted folder while the extension is installed.

## Updating

GitHub-installed Chrome extensions do not update automatically.

1. Export local history from the extension as a precaution.
2. Download and extract the newest release over the existing extension folder.
3. Open `chrome://extensions`.
4. Find **LinkWisp** and select **Reload**.

Browser-local storage normally survives a reload or code update. Export remains the safest backup.

## Removing

Open `chrome://extensions`, find the extension, and select **Remove**. Removing the extension also removes its local browser storage. It does not automatically delete redirect mappings already created online.

## Troubleshooting

- **Chrome cannot find `manifest.json`:** You selected the outer download folder. Select the inner folder containing `manifest.json`.
- **The extension disappears after moving files:** Restore the folder to its former location or load it again from its new location.
- **Creating links fails:** Confirm the service address and access code in extension settings.
