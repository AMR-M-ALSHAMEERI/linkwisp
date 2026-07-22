# Deploy a Personal LinkWisp Service

This guide deploys an independent LinkWisp Worker and D1 database to a Cloudflare account. The browser extension remains local; Cloudflare stores only the mappings required to resolve shareable short URLs.

The deployment model is intentionally owner-controlled:

- Anyone with an enabled, unexpired short URL can follow its redirect.
- Only a client with the private owner access code can create links.
- Individual links also use private management keys for edit, disable, enable, and delete operations.
- A public repository or Worker address does not grant access to the Cloudflare account or D1 database.

## Requirements

- Node.js 22 or newer
- pnpm 10 or newer
- A Cloudflare account on the Workers Free plan
- A password manager
- A local clone of LinkWisp with dependencies installed

No custom domain is required. Cloudflare automatically provides a `workers.dev` address suitable for a personal or hobby deployment.

## 1. Check the project

From the repository root:

```bash
pnpm install
pnpm check
pnpm build
cd apps/worker
pnpm exec wrangler --version
```

Use Wrangler 4.x or newer.

## 2. Authenticate Wrangler

```bash
pnpm exec wrangler login
pnpm exec wrangler whoami
```

Complete authorization in the browser and confirm that Wrangler selected the intended Cloudflare account. Do not copy Wrangler credentials into the repository.

## 3. Create and bind D1

Create the production database:

```bash
pnpm exec wrangler d1 create linkwisp-db
```

Cloudflare prints a `database_id` and may suggest a binding derived from the database name. LinkWisp's source code expects `env.DB`, so keep the binding name exactly `DB` in `apps/worker/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "linkwisp-db",
    "database_id": "YOUR_DATABASE_ID"
  }
]
```

Replace the existing database ID with the ID returned for your account. The database ID is a resource identifier, not a credential.

Validate the configuration without publishing:

```bash
pnpm exec wrangler deploy --dry-run
```

The output should list `env.DB (linkwisp-db)` as a D1 binding.

## 4. Apply the production migrations

Preview and apply the checked-in migrations:

```bash
pnpm exec wrangler d1 migrations list linkwisp-db --remote
pnpm exec wrangler d1 migrations apply linkwisp-db --remote
```

Confirm the remote operation when prompted. Verify the resulting schema:

```bash
pnpm exec wrangler d1 migrations list linkwisp-db --remote
pnpm exec wrangler d1 execute linkwisp-db --remote --command="PRAGMA table_info(links);"
```

No migrations should remain. The `links` table should include `code`, `destination`, `created_at`, `expires_at`, `disabled`, and `management_token_hash`.

## 5. Prepare the owner access code

Generate a unique random value of at least 32 characters and save it in a password manager as `LinkWisp Production ACCESS_TOKEN`.

Do not reuse a Cloudflare, GitHub, email, or computer password. Never put the value in `wrangler.jsonc`, source code, documentation, screenshots, issues, or release files.

## 6. Deploy and attach the secret

Deploy the Worker:

```bash
pnpm exec wrangler deploy
```

On the first deployment, approve creation of an account-level `workers.dev` subdomain. Wrangler prints the final origin, such as:

```text
https://linkwisp.YOUR_SUBDOMAIN.workers.dev
```

Before `ACCESS_TOKEN` exists, LinkWisp rejects authenticated creation requests. Attach the saved value immediately through Wrangler's interactive prompt:

```bash
pnpm exec wrangler secret put ACCESS_TOKEN
```

Paste the raw value only when prompted. Do not place it directly in the command or shell history. Verify only the secret name:

```bash
pnpm exec wrangler secret list
```

The result should contain `ACCESS_TOKEN` with type `secret_text`; Cloudflare does not reveal its value.

## 7. Verify and connect the extension

Check the public health route:

```text
https://linkwisp.YOUR_SUBDOMAIN.workers.dev/health
```

Expected response:

```json
{"status":"ok"}
```

In LinkWisp, open **Settings → Connection settings** and enter:

- **Worker address:** the `workers.dev` origin without `/health` or another path.
- **Access code:** the value saved in the password manager.

Select **Test and save**. The authenticated test uses `GET /api/session` and does not create or read a D1 link record.

Create a test link, open it on the development computer, and then open or scan it from a phone using a different network. Disable and re-enable the test mapping to verify that the locally stored management key controls the production record.

## Maintenance

Deploy reviewed Worker changes:

```bash
pnpm exec wrangler deploy
```

Apply future migrations before code that depends on them:

```bash
pnpm exec wrangler d1 migrations list linkwisp-db --remote
pnpm exec wrangler d1 migrations apply linkwisp-db --remote
```

Rotate the owner access code:

```bash
pnpm exec wrangler secret put ACCESS_TOKEN
```

Then replace the saved access code in each authorized Chrome profile. Old copies immediately lose creation access.

View live logs while diagnosing a problem:

```bash
pnpm exec wrangler tail
```

Database exports contain private URL mappings. Store them outside the repository and do not attach them to public issues.

## Official Cloudflare references

- [D1 getting started](https://developers.cloudflare.com/d1/get-started/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers routes and domains](https://developers.cloudflare.com/workers/configuration/routing/)
- [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/)
