# LinkWisp Mozilla Review Guide

This file accompanies the source archive submitted to addons.mozilla.org for the self-distributed (unlisted) Firefox version of LinkWisp.

## Submitted extension

- Add-on: LinkWisp
- Version: `0.3.0`
- Gecko ID: `linkwisp@amr-m-alshameeri`
- Target: Firefox Manifest V2
- Distribution: Mozilla-signed self-distribution (unlisted)
- License: MIT

LinkWisp is a local-first browser extension and self-hosted URL shortener. It uses WXT and Vite to bundle TypeScript, so the complete readable source and locked dependency graph are included for review.

## Reproducible build

The project is a pnpm workspace. The submitted source archive is created directly from the same clean Git commit used to build the extension.

### Environment

- Reference submission build: Windows x64
- Node.js 24.18.0 for the reference submission build; Node.js 22 or newer is supported
- pnpm 11.9.0
- Git
- The source is cross-platform and may be rebuilt on Windows, macOS, or Linux
- No commercial or web-based build tool

### Commands

From the extracted source archive root:

```bash
npm install --global pnpm@11.9.0
pnpm install --frozen-lockfile
pnpm zip:firefox
```

The unsigned Firefox package is generated at:

```text
apps/extension/.output/linkwispextension-0.3.0-firefox.zip
```

The unpacked build used to create it is:

```text
apps/extension/.output/firefox-mv2/
```

`pnpm-lock.yaml` pins the complete dependency graph. `package.json` pins pnpm 11.9.0 and the source package pins TypeScript, Vitest, and Mozilla `web-ext`; WXT and its Vite toolchain resolve through the committed lockfile.

The production extension contains generated JavaScript and CSS but no obfuscation. Source files are under `apps/extension/entrypoints/` and `apps/extension/lib/`.

## Static validation

Run:

```bash
pnpm check
pnpm test
pnpm lint:firefox
```

The Firefox lint command rebuilds the target and runs Mozilla `web-ext lint` with warnings treated as errors. The automated tests do not contact the production Worker or database.

## Functional review without production credentials

LinkWisp requires a user-configured Worker address and access code to create short links. The maintainer's production access code is not included or provided. Reviewers can run the included Worker locally with a reviewer-chosen test secret.

Create:

```text
apps/worker/.dev.vars
```

with:

```text
ACCESS_TOKEN=choose-a-temporary-review-token
```

Then run:

```bash
cd apps/worker
pnpm exec wrangler d1 migrations apply linkwisp-db --local
cd ../..
pnpm dev:worker
```

Keep that terminal running. In a second terminal, run:

```bash
pnpm dev:firefox
```

Alternatively, load `apps/extension/.output/firefox-mv2/manifest.json` temporarily from `about:debugging#/runtime/this-firefox`.

During LinkWisp onboarding enter:

```text
Worker address: http://127.0.0.1:8787
Access code: choose-a-temporary-review-token
```

The reviewer can then create, edit, disable, enable, delete, search, favorite, export, restore, and generate QR codes without contacting the maintainer's production deployment.

## Data transmission

Core shortening sends the selected destination URL, optional alias, expiration, and entered access code to the user-configured Worker. Management requests send the short-code record and its per-link management token to that same Worker.

The manifest therefore declares Mozilla's required `browsingActivity` and `authenticationInfo` categories. Link history, favorites, search terms, preferences, backups, and QR generation remain local. LinkWisp contains no advertising, telemetry, click analytics, remote code, or third-party QR service.

The optional update notification sends an anonymous request to GitHub's public Releases API no more than once per 24-hour cache period unless the user requests a refresh. It sends no LinkWisp history, destination, Worker address, access code, management token, backup content, or user identifier. Firefox declares `technicalAndInteraction` as optional and performs no update request until the user grants it; declining leaves every core feature available.

See `PRIVACY.md` for the complete public privacy policy.

## Third-party library

LinkWisp uses the open-source `qrcode` package from the npm registry for local QR generation. Its exact version and transitive dependencies are recorded in `apps/extension/package.json` and `pnpm-lock.yaml`.

All other packaged runtime code is generated from LinkWisp source and the open-source WXT/Vite build toolchain declared through the workspace manifests and lockfile.
