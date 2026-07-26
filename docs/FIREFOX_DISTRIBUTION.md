# Firefox Self-Distribution

This guide is for the LinkWisp maintainer. It describes preparation for Mozilla-signed self-distribution (the unlisted AMO channel). It does not make LinkWisp searchable in the Firefox Add-ons marketplace.

## Distribution model

Mozilla validates and signs the Firefox package. LinkWisp then distributes the signed `.xpi` through a separately approved project download surface. Users receive a permanently installable Firefox extension, but they still need their own LinkWisp Worker address and access code.

Never include or submit the maintainer's production access code. Mozilla reviewers can use the local Worker and a reviewer-chosen temporary token by following `AMO_BUILD.md`.

## Prepare the submission

Start from a clean, committed working tree and run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm lint:firefox
pnpm prepare:firefox-submission
```

The final command:

1. rebuilds and packages the Firefox target;
2. validates Manifest V2, version, and the stable Gecko ID;
3. refuses to package a dirty working tree;
4. copies the unsigned extension ZIP into an ignored submission directory;
5. creates the reviewer source ZIP directly from the same Git commit;
6. copies the Mozilla review instructions;
7. writes SHA-256 checksums.

The output is:

```text
outputs/firefox-submission/vVERSION/
  linkwisp-VERSION-firefox-unsigned.zip
  linkwisp-VERSION-source.zip
  AMO_REVIEW.md
  SHA256SUMS.txt
```

The automatically generated WXT `*-sources.zip` is not the reviewer source archive because it does not contain the workspace lockfile or complete build instructions.

## Mozilla submission choices

In the AMO Developer Hub:

1. Choose to distribute the add-on **On your own**.
2. Upload `linkwisp-VERSION-firefox-unsigned.zip`.
3. Select compatible Firefox platforms deliberately.
4. State that source code is required.
5. Upload `linkwisp-VERSION-source.zip`.
6. Use `AMO_BUILD.md` as the reviewer notes.
7. Confirm that the submission is unlisted/self-distributed before the final submission.

Mozilla may sign automatically or select the submission for manual review. Do not publish or attach the returned `.xpi` until it has been downloaded, its signature has been accepted by normal Firefox, and the complete LinkWisp acceptance checklist has passed.

## After signing

1. Download the signed `.xpi` from AMO.
2. Record its filename, size, SHA-256 digest, signing status, and AMO version.
3. Install it through Firefox's **Install Add-on From File** action.
4. Confirm the Gecko ID and version in Firefox.
5. Test onboarding against a local Worker first.
6. Test the complete popup, shortcut, context-menu, storage, backup, QR, and lifecycle flows.
7. Decide and explicitly approve the GitHub distribution surface.
8. Update public installation and privacy documentation before distribution.

Do not modify the existing `v0.2.0` GitHub Release or move its tag. A signed Firefox artifact must be published through a separately approved immutable release decision.
