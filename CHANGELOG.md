# Changelog

All notable LinkWisp changes are recorded here. Versions follow semantic versioning.

## 0.3.0 - 2026-07-30

### Added

- Browser-aware update notifications with a 24-hour cache, manual refresh, installed/latest version details, and last checked time
- Chrome routing to the official stable release and Firefox routing only to a matching Mozilla-signed release
- A backup-before-update action and quiet Settings indicator for available updates

### Changed

- Made the current-version state compact and the available-update state more prominent
- Added contextual checking, retry, consent, and refresh labels plus a visible About-row keyboard focus indicator

### Security and privacy

- Strict semantic-version, repository, release-state, and release-URL validation before an update is announced
- Request timeout and safe unavailable-state handling without GitHub credentials or LinkWisp user data
- Optional Firefox technical-and-interaction consent so declining update checks never disables core functionality

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
