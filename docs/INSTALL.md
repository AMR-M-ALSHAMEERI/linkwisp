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

## First setup

LinkWisp opens a setup guide the first time this version runs. Enter:

- **Worker address:** the local development address or public service address provided by the LinkWisp service owner.
- **Access code:** the private creation code provided by the same owner.

Select **Test and finish setup**. LinkWisp checks the address and access code without creating a short link. Successful values are stored only in that browser profile. Select **Not now** to postpone setup; the guide returns next time.

You can reopen the guide later through **Connection settings → Run setup guide**. Use **Test and save** there to verify changed settings before replacing the saved values.

Do not delete or move the extracted folder while the extension is installed.

## Updating

GitHub-installed Chrome extensions do not update automatically.

1. Export local history from the extension as a precaution.
2. Download and extract the newest release over the existing extension folder.
3. Open `chrome://extensions`.
4. Find **LinkWisp** and select **Reload**.

Browser-local storage normally survives a reload or code update. Export remains the safest backup.

## Back up or move local history

Open LinkWisp and use **Export** under **Local backup**. The browser downloads a dated `.json` file containing up to 200 local history records.

To restore it, select **Import**, choose the backup, review the confirmation, and approve the import. New records are added and matching records are updated. LinkWisp validates the complete file before changing local storage.

The backup does not contain the main service access code. It does contain private management keys needed to edit or delete individual links, so do not publish it, attach it to an issue, or commit it to GitHub.

## Search and favorites

Use **Search history** to find locally stored links by alias, short URL, or destination. Search happens only on the device and does not contact the LinkWisp service.

Select the star beside a link to add or remove it from favorites. Favorite links appear above other recent links and favorite state is preserved in exported backups.

## QR codes

Select **QR** on any recent link to display a scannable code for its short URL. Select **Download PNG** to save it as `linkwisp-ALIAS-qr.png`, or **Close** to return to history.

The QR dialog reports the link's current local state. Active links are ready to scan, disabled links will redirect again after being enabled, and expired links currently open an expired-link response. Viewing or downloading the QR remains available in every state because the encoded short URL itself does not change.

QR generation happens inside the extension. No link is sent to a QR website or additional online service.

## Removing

Open `chrome://extensions`, find the extension, and select **Remove**. Removing the extension also removes its local browser storage. It does not automatically delete redirect mappings already created online.

## Troubleshooting

- **Chrome cannot find `manifest.json`:** You selected the outer download folder. Select the inner folder containing `manifest.json`.
- **The extension disappears after moving files:** Restore the folder to its former location or load it again from its new location.
- **Creating links fails:** Confirm the service address and access code in extension settings.
- **The Worker cannot be reached:** Confirm the address, Internet connection, and—during local development—that `pnpm dev:worker` is still running.
- **Invalid access code:** Re-enter the code supplied by the service owner. LinkWisp does not recover or display that secret.
- **A backup will not import:** Confirm that it is an unmodified LinkWisp JSON backup created by a supported version.
