# Release LinkWisp

This guide is for project maintainers. End users should follow [INSTALL.md](INSTALL.md).

## What the automation does

Every push and pull request to `main` runs type checks, automated tests, Chrome and Worker production builds, and a strict Mozilla lint of the Firefox build. Pushing a version tag such as `v0.2.0` starts the release workflow, which:

1. Installs the exact dependencies from `pnpm-lock.yaml`.
2. Runs all TypeScript checks.
3. Runs the extension and Worker/D1 automated tests.
4. Builds and strictly lints the Firefox target without publishing it.
5. Confirms that the Git tag matches the extension package version.
6. Builds the Chrome extension ZIP.
7. Creates a SHA-256 checksum file beside the ZIP.
8. Publishes both Chrome files in a GitHub Release with generated release notes.

The included `INSTALL.html`, extension assets, and `manifest.json` are all inside the ZIP. Node.js and pnpm are not required by people installing that finished archive.

The current release workflow publishes only the tested Chrome archive. `pnpm zip:firefox` can prepare Firefox and source archives, but they must not be attached to a release until the exact Firefox build has passed the manual desktop checklist in `DEVELOPMENT.md`. A Firefox package distributed for normal installation must also be signed through Mozilla; the WXT ZIP alone is a development/submission artifact.

For Mozilla self-distribution, follow [FIREFOX_DISTRIBUTION.md](FIREFOX_DISTRIBUTION.md). The dedicated `pnpm prepare:firefox-submission` command creates an unsigned Firefox upload, a complete Git-archived reviewer source package, review notes, and checksums from one clean commit. Do not use WXT's smaller automatic `*-sources.zip` as the Mozilla reviewer source because it omits the workspace lockfile and complete build instructions.

## Prepare a release

1. Decide the version number using semantic versioning: patch for compatible fixes, minor for compatible features, and major for breaking changes.
2. Update the matching `version` value in the root, extension, and Worker `package.json` files.
3. Update public documentation and review the privacy and installation statements.
4. Confirm the root `LICENSE` file and README still identify the MIT License and correct copyright holder.
5. Run the local verification commands:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm lint:firefox
pnpm release
pnpm --filter @linkwisp/extension verify:release-version v0.2.0
```

Replace `v0.2.0` with the version being prepared. Inspect the ZIP under `apps/extension/.output/` and test it in a clean Chrome profile before publishing.

## Publish a release

Commit and push the prepared version first. Creating and pushing the tag is the publishing trigger:

```bash
git tag -a v0.2.0 -m "LinkWisp v0.2.0"
git push origin v0.2.0
```

Do not reuse or move a published version tag. If a release needs a correction, prepare a new patch version instead. Monitor the **Actions** page, then confirm the GitHub Release contains one ZIP and its matching `.sha256` file.

## Verify the downloaded archive

On PowerShell, a user or maintainer can compare the downloaded ZIP with its published checksum:

```powershell
Get-FileHash .\linkwisp-0.2.0-chrome.zip -Algorithm SHA256
Get-Content .\linkwisp-0.2.0-chrome.zip.sha256
```

The two hexadecimal hashes must match. A mismatch means the file is incomplete or different from the file produced by the release workflow.
