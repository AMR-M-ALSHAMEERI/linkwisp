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

The local Worker must remain running while testing creation and redirects. Local short links work only on the development computer; production deployment later provides a public `workers.dev` address.

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
3. Select **Edit**, enter another HTTP or HTTPS destination, and confirm the same short URL opens the new destination.
4. Select **Disable** and confirm the short URL returns `404`; select **Enable** and confirm it redirects again.
5. Select **Delete**, confirm the warning, and confirm the short URL then returns `404`.

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

## Cloudflare deployment

Authentication and production deployment will be documented once the local MVP is verified. Never commit Cloudflare API tokens or the link-creation access token.

## GitHub workflow

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
