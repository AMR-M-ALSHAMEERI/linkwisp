# LinkWisp Privacy Policy

Effective date: July 30, 2026

LinkWisp is a local-first, self-hosted browser extension. It does not provide a shared LinkWisp account, advertising service, or analytics platform. Each user chooses and controls the Cloudflare Worker service to which the extension connects.

## Data kept on the device

LinkWisp stores the following information in browser-local storage:

- short-link history and destinations;
- aliases, creation dates, expiration dates, and current link state;
- favorites and search-related interface state;
- the configured Worker address and access code;
- private per-link management tokens;
- extension preferences and onboarding state;
- validated update-check metadata, including the latest version, official release address, and last checked time.

History search, favorite changes, QR generation, and normal interface use occur locally. LinkWisp does not transmit those actions to the developer.

Local backups exclude the main Worker access code. They include link records and per-link management tokens so restored links remain manageable. Users should therefore protect backup files as sensitive data.

## Data sent to the configured Worker

Creating a short link sends the destination URL, optional alias, selected expiration, and configured access code to the Worker chosen by the user.

Editing, disabling, enabling, or deleting a link sends the relevant short code, requested change, and its private management token to that Worker. Older records without a management token may use the configured owner access code.

Testing connection settings sends the Worker address request and entered access code to the selected Worker without creating or reading a link mapping.

LinkWisp does not send local history, favorites, search terms, backup files, or generated QR images to an external QR or analytics service.

## Data sent when checking for updates

LinkWisp can make an anonymous request to GitHub's public Releases API to compare the installed version with the latest LinkWisp release. The request does not include LinkWisp history, destinations, aliases, Worker addresses, access codes, management tokens, backup contents, or a LinkWisp user identifier.

GitHub receives the ordinary network information required to serve the request, such as the requester's IP address and standard HTTP metadata, under GitHub's privacy terms. LinkWisp validates the repository, version, and release address before displaying or locally caching the result. A successful result is reused for 24 hours unless the user selects **Check updates**.

In Firefox, update checking uses Mozilla's optional `technicalAndInteraction` data-transmission permission. Declining that permission disables update checks only; shortening, history, backup, and all other core features continue to work. Chrome does not provide an equivalent runtime data-category prompt.

## Online redirect data

The Worker stores the minimum mapping and lifecycle information needed to operate a short link:

- short code;
- destination URL;
- creation and expiration timestamps;
- enabled or disabled state;
- a hash of the per-link management token.

Opening a public short URL sends a normal web request to the configured Cloudflare Worker. The Worker reads the mapping and returns a redirect or a branded unavailable-link page. LinkWisp does not store click analytics in D1.

Cloudflare may process ordinary network and infrastructure information, such as IP addresses and request logs, under the terms and settings of the deployment owner's Cloudflare account. Deployment owners are responsible for operating their service and complying with laws that apply to them.

## Retention and deletion

Browser-local data remains until the user clears it, removes the extension data, or imports a replacement backup.

Online mappings remain in the deployment owner's D1 database until deleted. Expiration stops a mapping from redirecting but does not automatically erase its database record. A user who still has the per-link management token can permanently delete the mapping through LinkWisp.

Clearing local history does not delete online mappings and removes the local management tokens needed to control them.

## Sharing and sale

LinkWisp does not sell personal information. The project contains no advertising SDK, telemetry SDK, or developer-operated analytics endpoint.

Information is transmitted only to the service selected by the user, GitHub when update checking is enabled, and infrastructure providers required to complete those requests.

## Security

The main Worker access code is stored as a Cloudflare secret by the deployment owner and must not be committed to source control or included in a release. D1 stores only a SHA-256 hash of each per-link management token. Credential comparisons use Cloudflare's timing-safe Web Crypto operation.

No software can guarantee absolute security. Users should keep Worker credentials and exported backups private and promptly delete mappings that should no longer exist.

## Children

LinkWisp is a developer and personal productivity tool and is not directed to children.

## Changes

Material privacy changes will be documented in the repository and a later version of this policy. Published release artifacts remain unchanged.

## Contact

Questions and security reports can be submitted through the [LinkWisp GitHub repository](https://github.com/AMR-M-ALSHAMEERI/linkwisp).
