# LinkWisp

<p align="center">
  <img src="apps/extension/public/brand/wisp-link.svg" width="96" height="96" alt="LinkWisp Wisp Link logo" />
</p>

A local-first browser extension for creating clean, shareable short links through a small service you control. Link history and preferences stay on the user's device; only the short-code-to-destination mapping is stored online so links can redirect from any browser.

## Current status

This repository is in active MVP development. The initial release targets Chrome and Chromium browsers through a GitHub Release ZIP.

## Planned MVP

- Shorten the current tab without copying and pasting
- Remove common tracking parameters before shortening
- Generate a random short code or request a custom alias
- Copy the result automatically
- Keep searchable history locally in the extension
- Expire, disable, or delete links
- Generate QR codes locally
- Offer a right-click action and keyboard shortcut
- Export and import local history

## Architecture

```text
Browser extension (local)     Cloudflare Worker + D1 (online)
-------------------------     -------------------------------
Popup and settings      ───►  Create/manage redirect mappings
URL cleaning                  Resolve /:code and redirect
Local history                 Store only required mappings
QR generation
```

The Cloudflare service is our own code and is not Bitly, TinyURL, or another shortening provider. Cloudflare only supplies the internet-accessible runtime and database.

## Install the GitHub release

The first packaged release is not available yet. When it is published, nontechnical installation instructions will be available in [docs/INSTALL.md](docs/INSTALL.md).

## Development setup

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Repository layout

```text
apps/extension/   WXT browser extension
apps/worker/      Cloudflare Worker and D1 migration
docs/             Public user and contributor documentation
```

## Brand assets

The primary **Wisp Link** mark lives at `apps/extension/public/brand/wisp-link.svg`. Chrome-ready PNG icons are provided at 16, 32, 48, 96, and 128 pixels under `apps/extension/public/icon/`.

The core palette is deep green `#215F42`, mint `#8DE0B2`, and soft cream `#F4F7F2`. The icon uses two connected rounded loops with a short flowing trail, representing a link that remains lightweight and easy to share.

## Privacy model

The extension stores history, notes, favorites, and preferences in browser-local storage. Creating a shareable short link necessarily sends its destination and selected alias to the configured Worker. No click analytics are collected in the MVP.

Link history can be exported as a versioned JSON backup and restored on another installation. The backup excludes the main service access code, but it contains private per-link management keys and must be stored securely.

History search and favorites run entirely inside the extension. Search terms and favorite choices are not sent to the Worker; favorite state is included in local backups.

QR codes are generated locally from completed short URLs. LinkWisp does not send QR contents to an external QR service or store a second QR copy in D1.

First-run onboarding explains the two connection values and verifies the Worker address plus access code without creating a link. Connection settings can run the same test again whenever configuration changes.

The popup is organized into Create, Links, and Settings views. Global actions report through an accessible floating notification, while contextual onboarding and QR state messages remain beside the content they explain.

## License

No license has been selected yet. Until one is added, normal copyright restrictions apply.
