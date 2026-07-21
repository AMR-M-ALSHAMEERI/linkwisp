# Release LinkWisp

This guide is for project maintainers. End users should follow [INSTALL.md](INSTALL.md).

## What the automation does

Every push and pull request to `main` runs type checks and production builds. Pushing a version tag such as `v0.1.0` starts the release workflow, which:

1. Installs the exact dependencies from `pnpm-lock.yaml`.
2. Runs all TypeScript checks.
3. confirms that the Git tag matches the extension package version.
4. Builds the Chrome extension ZIP.
5. Creates a SHA-256 checksum file beside the ZIP.
6. Publishes both files in a GitHub Release with generated release notes.

The included `INSTALL.html`, extension assets, and `manifest.json` are all inside the ZIP. Node.js and pnpm are not required by people installing that finished archive.

## Prepare a release

1. Decide the version number using semantic versioning: patch for compatible fixes, minor for compatible features, and major for breaking changes.
2. Update the matching `version` value in the root, extension, and Worker `package.json` files.
3. Update public documentation and review the privacy and installation statements.
4. Confirm the root `LICENSE` file and README still identify the MIT License and correct copyright holder.
5. Run the local verification commands:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm release
pnpm --filter @linkwisp/extension verify:release-version v0.1.0
```

Replace `v0.1.0` with the version being prepared. Inspect the ZIP under `apps/extension/.output/` and test it in a clean Chrome profile before publishing.

## Publish a release

Commit and push the prepared version first. Creating and pushing the tag is the publishing trigger:

```bash
git tag -a v0.1.0 -m "LinkWisp v0.1.0"
git push origin v0.1.0
```

Do not reuse or move a published version tag. If a release needs a correction, prepare a new patch version instead. Monitor the **Actions** page, then confirm the GitHub Release contains one ZIP and its matching `.sha256` file.

## Verify the downloaded archive

On PowerShell, a user or maintainer can compare the downloaded ZIP with its published checksum:

```powershell
Get-FileHash .\linkwisp-0.1.0-chrome.zip -Algorithm SHA256
Get-Content .\linkwisp-0.1.0-chrome.zip.sha256
```

The two hexadecimal hashes must match. A mismatch means the file is incomplete or different from the file produced by the release workflow.
