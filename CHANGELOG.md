# Changelog

All notable LinkWisp changes are recorded here. Versions follow semantic versioning.

## 0.2.0 - 2026-07-26

### Added

- Automated extension and Worker/D1 tests covering URL cleaning, backups, authorization, validation, redirects, unavailable-link pages, and lifecycle operations
- A Firefox Manifest V2 development target with browser-specific popup and shortcut handling
- Strict Mozilla `web-ext` validation in continuous integration and tagged-release checks
- A shared branded confirmation system for clearing local history and permanently deleting individual online links

### Changed

- Replaced prompt-based link editing with a focused dialog for destination and expiration changes
- Kept edit validation and service errors inside the dialog while preserving the short URL and QR identity
- Made context-menu registration idempotent to prevent duplicate-item errors after extension reloads
- Normalized Firefox button and form-control sizing without changing the accepted Chrome appearance
- Expanded public development, installation, release, privacy, and Firefox documentation

### Security

- Added timing-safe Worker credential comparison and generated binding-contract checks
- Added automated secret-isolation coverage so tests cannot read development or production credentials

## 0.1.0 - 2026-07-22

- First public Chrome/Chromium release
- Local-first history, search, favorites, QR generation, backup/restore, onboarding, and link lifecycle management
- Personal Cloudflare Worker + D1 deployment model with branded unavailable-link pages
