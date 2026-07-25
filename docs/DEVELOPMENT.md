# Development Environment

## Recommended environment

Use a local Windows, macOS, or Linux computer for the full workflow. Google Colab can edit or build the repository, but it cannot load the extension into the Chrome browser running on your personal computer. Colab sessions are also temporary, so the repository must be cloned or mounted again when the runtime resets.

Install:

- Git
- Node.js 22 or newer
- pnpm 10 or newer
- Google Chrome or another Chromium browser
- A free Cloudflare account for remote Worker deployment

## Get the repository

```bash
git clone YOUR_REPOSITORY_URL
cd linkwisp
pnpm install
```

## Run the extension

```bash
pnpm dev:extension
```

Then open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the Chrome output directory printed by WXT.

## Run the Worker locally

```bash
pnpm dev:worker
```

Copy `apps/worker/.dev.vars.example` to `apps/worker/.dev.vars` and replace the example access token. `.dev.vars` is ignored by Git and must never be committed.

Apply the local database migration:

```bash
cd apps/worker
pnpm exec wrangler d1 migrations apply linkwisp-db --local
```

Return to the repository root and start the local Worker:

```bash
cd ../..
pnpm dev:worker
```

Leave that terminal open. A successful startup prints a local address, normally `http://localhost:8787`.

Build or rebuild the Chrome extension:

```bash
pnpm --filter @linkwisp/extension build
```

Load `apps/extension/.output/chrome-mv3` through `chrome://extensions`, or select **Reload** if LinkWisp is already loaded. In LinkWisp's connection settings enter:

```text
Worker address: http://127.0.0.1:8787
Access code: the ACCESS_TOKEN value from apps/worker/.dev.vars
```

The local Worker must remain running while testing creation and redirects. Local short links work only on the development computer. A deployed Worker provides a public `workers.dev` address, while the extension and its history remain local.

## Run automated tests

From the repository root:

```bash
pnpm test
```

This runs two complementary suites:

- Extension unit tests run with Vitest and WXT's testing plugin. They cover URL cleaning, backup validation and merging, connection checks, API request construction, per-link credential selection, and API error handling.
- Worker integration tests run locally inside Cloudflare's Workers runtime through its Vitest integration. They apply the real D1 migrations to an isolated test database and cover authorization, creation validation, redirects, unavailable-link pages, editing, disabling, enabling, expiration, and deletion.

Tests never contact the production Worker or production D1 database. The Worker suite receives a test-only access token and isolated local D1 binding from `vitest.config.ts`. It loads `test/wrangler.test.jsonc` instead of the deployment configuration, so Cloudflare's test runtime does not read `.dev.vars` or any real credential.

For the same sequence used by GitHub Actions:

```bash
pnpm check
pnpm test
pnpm build
```

GitHub Actions runs all three commands on pushes and pull requests. The release workflow repeats the checks before creating an archive, so a failing test prevents a new release from being published.

## Test link lifecycle controls

After pulling a version that adds a migration, stop the local Worker with `Ctrl+C`, apply pending migrations, and start it again:

```bash
cd apps/worker
pnpm exec wrangler d1 migrations apply linkwisp-db --local
cd ../..
pnpm dev:worker
```

Rebuild the extension and select **Reload** for LinkWisp on `chrome://extensions`. Then verify:

1. Create a link with **Never** selected and confirm that it redirects.
2. Create a link with an expiration and confirm the expiry appears in Recent links.
3. Select **Edit** and confirm the dialog shows the same short URL, current state, destination, and current expiration.
4. Change the destination to another HTTP or HTTPS URL containing a test `utm_*` parameter, leave **Keep current expiration** selected, save, and confirm the same short URL opens the cleaned new destination.
5. Reopen **Edit** and test **Never expires**, a preset expiration, and a future custom date. Confirm the history card updates while the alias and short URL remain unchanged.
6. Enter an invalid destination, a past custom date, and an unchanged form. Confirm each error remains visible inside the dialog and no update is sent. Confirm **Cancel**, `Esc`, and a backdrop click close without saving.
7. Select **Disable** and confirm the short URL returns the branded **Link paused** page with HTTP `404`; select **Enable** and confirm it redirects again.
8. Select **Delete**, confirm the warning, and confirm the short URL returns the branded **Link not found** page with HTTP `404`.
9. Let a temporary test link expire and confirm it returns the branded **Link expired** page with HTTP `410`.
10. Check the status pages on a narrow mobile viewport, in dark mode, and with reduced motion enabled. Confirm they reveal no destination URL and make no external asset requests.

**Clear local history** only removes records from this Chrome profile. It does not delete mappings from D1. Use each link's **Delete** action when the online mapping must be removed.

## Test local backup and restore

1. Create at least two links, then select **Export** under Local backup.
2. Open the downloaded JSON only to inspect it. Confirm it has `format`, `version`, `exportedAt`, and `links` fields and does not contain the main access code.
3. Keep the backup, clear local history, and confirm the online short links still redirect.
4. Select **Import**, choose the backup, approve the confirmation, and confirm the history returns.
5. Edit or disable one restored link to prove its per-link management key was preserved.
6. Try importing an unrelated JSON file and confirm LinkWisp rejects it without changing history.

Backup files are intentionally ignored nowhere by a universal filename rule because users may choose any download folder. Treat them as secrets and never place them in the repository.

## Test search and favorites

1. Create links with distinguishable aliases and destinations.
2. Search for part of an alias, short URL, and destination; confirm each finds the expected record.
3. Search for text that does not exist and confirm the empty result message appears.
4. Clear the search, select an empty star, and confirm the filled star and link move to the favorites area at the top.
5. Close and reopen the popup and confirm the favorite remains.
6. Export a backup, remove the favorite, import the backup, and confirm the favorite is restored.

Both features operate on `browser.storage.local`; they require no Worker or D1 changes.

## Test local QR generation

1. Select **QR** on an active recent link and confirm the dialog shows the correct short URL and a QR image.
2. Scan the code with a phone and confirm it opens the short URL, which then redirects normally.
3. Select **Download PNG** and confirm a file named `linkwisp-ALIAS-qr.png` is saved.
4. Open the PNG and scan it independently.
5. Disable the mapping, open QR again, and confirm the disabled warning appears while view and download remain available.
6. Open QR for an expired mapping and confirm the expiration warning includes its date while view and download remain available.
7. Re-enable the disabled mapping and confirm the same QR image redirects again.

The extension uses the browser build of `qrcode`. Generation occurs locally; this feature adds no host permission, API route, D1 field, or external request.

## Test first-run onboarding

This milestone adds `GET /api/session`, so stop and restart the local Worker before testing. No database migration is required.

1. Restart `pnpm dev:worker`, rebuild/reload the extension, and open LinkWisp.
2. Confirm the setup guide appears with existing settings prefilled.
3. Enter a wrong access code and confirm the guide reports **Invalid access code** without closing or replacing saved settings.
4. Restore the correct code, select **Test and finish setup**, and confirm the dialog closes with a success message.
5. Close and reopen the popup and confirm onboarding no longer opens automatically.
6. Open **Connection settings**, select **Run setup guide**, and confirm it can be reopened manually.
7. Change the Worker address to an unreachable address and select **Test and save**; confirm the existing saved connection continues to create links afterward.
8. Restore the correct address and confirm **Test and save** succeeds.

The authenticated check verifies the Worker and owner access code without inserting, updating, or reading a D1 link record.

## Brand and icon development

The editable source mark is `apps/extension/public/brand/wisp-link.svg`. PNG toolbar and store assets live in `apps/extension/public/icon/` at 16, 32, 48, 96, and 128 pixels. `wxt.config.ts` declares both the extension icons and the toolbar action icons explicitly.

When changing the source mark:

1. Preserve the 128x128 square view box and core deep-green, mint, and cream palette.
2. Rasterize each required PNG from the same SVG source.
3. Inspect 128 pixels for clean geometry and 16 pixels for toolbar recognition.
4. Run the production build and confirm every icon is copied into `.output/chrome-mv3/icon/`.
5. Reload the unpacked extension and inspect the toolbar, `chrome://extensions`, popup header, onboarding dialog, QR dialog, and long history content.

The popup uses browser-native HTML and CSS. Visual changes must not hide focus indicators, state labels, backup warnings, or onboarding error messages.

When the unpacked extension is reloaded, its installation listener clears LinkWisp's existing context-menu entries before recreating **Shorten this page**. This makes registration idempotent and prevents Chrome's `Cannot create item with duplicate id shorten-current-page` runtime error. After changing the background entrypoint, select **Reload** twice and confirm the extension's **Errors** view remains empty and the page context menu contains one LinkWisp action.

## Test popup navigation and notifications

1. Select Create, Links, and Settings and confirm only the correct panels are visible.
2. Close and reopen the popup and confirm the selected view is remembered for the browser session.
3. Create enough history records to exceed eight; verify Show more and Show less, then search for a record outside the first eight.
4. Trigger copy, favorite, disable, backup, and connection actions while scrolled in different views; confirm the floating notification is always visible.
5. Confirm success notifications dismiss automatically, error notifications remain until dismissed or replaced, and the close button works.
6. Confirm onboarding errors and active/disabled/expired QR guidance remain inline inside their dialogs.
7. Generate and download a center-branded QR code, then scan both preview and PNG on more than one phone if available.
8. Confirm a selected tab changes smoothly and its panel fades upward without delaying interaction.
9. Confirm toast messages animate in, replacement messages restart cleanly, and automatic/manual dismissal animates out.
10. Enable the operating system or browser reduced-motion preference and confirm navigation and notifications update without noticeable movement.
11. Open Settings, select **About LinkWisp**, and confirm the dialog shows the manifest version and developer/project links. Close it with the button, `Esc`, and a click outside the dialog.

The Wisp Link overlay covers only a small central area, keeps the quiet margin untouched, and uses QR error-correction level H. Scanning remains the acceptance criterion; a visually attractive QR that scans unreliably must not be released.

Motion is intentionally limited to 140–180 ms and never controls application logic. The `prefers-reduced-motion: reduce` media query reduces animation and transition durations to effectively instant changes.

## Cloudflare deployment

The local MVP has been verified against a production Worker and D1 database. Follow [DEPLOYMENT.md](DEPLOYMENT.md) to create an independent deployment, apply the migrations, store `ACCESS_TOKEN` as an encrypted Worker secret, and connect the extension.

Never commit Cloudflare login credentials, Wrangler OAuth credentials, recovery codes, `.dev.vars`, database exports, or the link-creation access token. The D1 database ID in `wrangler.jsonc` identifies a binding but does not authorize Cloudflare account access.

`apps/worker/worker-configuration.d.ts` is generated from `wrangler.jsonc` and committed. After adding or renaming a binding or required secret, regenerate it from `apps/worker`:

```bash
pnpm run types
```

The Worker check runs Wrangler's `--check` mode before TypeScript so CI fails when the generated binding contract is stale.

The repository's `.gitattributes` keeps text files on LF line endings so generated metadata is consistent on Windows and Linux. Wrangler must also be able to resolve `apps/worker/src/index.ts` while generating types. If a restricted development sandbox blocks that entrypoint, the output can omit `Cloudflare.GlobalProps` and later fail on GitHub Actions. Run `pnpm run types` from an ordinary terminal with normal access, then confirm the generated file contains `mainModule: typeof import("./src/index")` before committing it.

## GitHub workflow

GitHub Actions automatically checks and builds pushes and pull requests to `main`. A pushed `v*` tag can publish a versioned extension ZIP and SHA-256 checksum. See [RELEASING.md](RELEASING.md) before creating a tag; pushing a release tag is a publishing action.

1. Create an empty GitHub repository without generated files.
2. Initialize this project as a Git repository if necessary.
3. Add the GitHub repository as `origin`.
4. Commit source code and public documentation.
5. Confirm that `project-notes/` and `.dev.vars` do not appear in `git status`.
6. Push the branch.

Typical commands:

```bash
git init
git add .
git commit -m "Initial URL shortener MVP scaffold"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

## Optional Colab workflow

Colab is suitable for inspecting files or running builds, not interactive extension testing.

```python
!git clone YOUR_REPOSITORY_URL
%cd linkwisp
!corepack enable
!pnpm install
!pnpm build
```

Do not place production secrets directly in notebook cells. Colab users still need to download the built extension and load it into Chrome locally for testing.
