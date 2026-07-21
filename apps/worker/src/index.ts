interface Env {
  DB: D1Database;
  ACCESS_TOKEN: string;
}

interface CreateLinkBody {
  destination?: unknown;
  customCode?: unknown;
  expiresAt?: unknown;
}

interface UpdateLinkBody {
  destination?: unknown;
  expiresAt?: unknown;
  disabled?: unknown;
}

interface LinkRow {
  code: string;
  destination: string;
  created_at: string;
  expires_at: string | null;
  disabled: number;
  management_token_hash: string | null;
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

function randomValue(length: number): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return [...values].map((value) => alphabet[value % alphabet.length]).join("");
}

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

function isCreatorAuthorized(request: Request, env: Env): boolean {
  const token = bearerToken(request);
  return Boolean(env.ACCESS_TOKEN) && token === env.ACCESS_TOKEN;
}

async function isLinkAuthorized(request: Request, link: LinkRow, env: Env): Promise<boolean> {
  const token = bearerToken(request);
  if (!token) return false;
  if (token === env.ACCESS_TOKEN) return true;
  return Boolean(link.management_token_hash) && await hashToken(token) === link.management_token_hash;
}

function validateDestination(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 8192) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function validateExpiration(value: unknown): { valid: true; value: string | null } | { valid: false } {
  if (value === undefined || value === null || value === "") return { valid: true, value: null };
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return { valid: false };

  const expiresAt = new Date(value).toISOString();
  return Date.parse(expiresAt) > Date.now()
    ? { valid: true, value: expiresAt }
    : { valid: false };
}

function publicRecord(link: LinkRow, origin: string): Record<string, unknown> {
  return {
    code: link.code,
    destination: link.destination,
    shortUrl: `${origin}/${link.code}`,
    createdAt: link.created_at,
    expiresAt: link.expires_at,
    disabled: Boolean(link.disabled)
  };
}

async function findLink(code: string, env: Env): Promise<LinkRow | null> {
  return env.DB.prepare(
    "SELECT code, destination, created_at, expires_at, disabled, management_token_hash FROM links WHERE code = ?1"
  ).bind(code).first<LinkRow>();
}

async function createLink(request: Request, env: Env): Promise<Response> {
  if (!isCreatorAuthorized(request, env)) return json({ error: "Invalid access code." }, 401);

  let body: CreateLinkBody;
  try {
    body = await request.json<CreateLinkBody>();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const destination = validateDestination(body.destination);
  if (!destination) return json({ error: "Enter a valid HTTP or HTTPS destination." }, 400);

  if (body.customCode !== undefined && typeof body.customCode !== "string") {
    return json({ error: "Custom alias must be text." }, 400);
  }

  const requestedCode = typeof body.customCode === "string" ? body.customCode.trim() : "";
  if (requestedCode && !CODE_PATTERN.test(requestedCode)) {
    return json({ error: "Alias must be 3-32 letters, numbers, hyphens, or underscores." }, 400);
  }

  const expiration = validateExpiration(body.expiresAt);
  if (!expiration.valid) return json({ error: "Expiration must be a valid future date." }, 400);

  const origin = new URL(request.url).origin;
  const managementToken = randomValue(40);
  const managementTokenHash = await hashToken(managementToken);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = requestedCode || randomValue(7);
    const createdAt = new Date().toISOString();
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO links
        (code, destination, created_at, expires_at, management_token_hash)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    ).bind(code, destination, createdAt, expiration.value, managementTokenHash).run();

    if (result.meta.changes > 0) {
      const link: LinkRow = {
        code,
        destination,
        created_at: createdAt,
        expires_at: expiration.value,
        disabled: 0,
        management_token_hash: managementTokenHash
      };
      return json({ ...publicRecord(link, origin), managementToken }, 201);
    }

    if (requestedCode) return json({ error: "That custom alias is already in use." }, 409);
  }

  return json({ error: "Could not allocate a short code. Try again." }, 503);
}

async function updateLink(request: Request, code: string, env: Env): Promise<Response> {
  const link = await findLink(code, env);
  if (!link) return json({ error: "Link not found." }, 404);
  if (!await isLinkAuthorized(request, link, env)) return json({ error: "Invalid management code." }, 401);

  let body: UpdateLinkBody;
  try {
    body = await request.json<UpdateLinkBody>();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (body.destination === undefined && body.expiresAt === undefined && body.disabled === undefined) {
    return json({ error: "Provide at least one field to update." }, 400);
  }

  let destination = link.destination;
  if (body.destination !== undefined) {
    const validated = validateDestination(body.destination);
    if (!validated) return json({ error: "Enter a valid HTTP or HTTPS destination." }, 400);
    destination = validated;
  }

  let expiresAt = link.expires_at;
  if (body.expiresAt !== undefined) {
    const expiration = validateExpiration(body.expiresAt);
    if (!expiration.valid) return json({ error: "Expiration must be a valid future date or null." }, 400);
    expiresAt = expiration.value;
  }

  let disabled = Boolean(link.disabled);
  if (body.disabled !== undefined) {
    if (typeof body.disabled !== "boolean") return json({ error: "Disabled must be true or false." }, 400);
    disabled = body.disabled;
  }

  await env.DB.prepare(
    "UPDATE links SET destination = ?1, expires_at = ?2, disabled = ?3 WHERE code = ?4"
  ).bind(destination, expiresAt, disabled ? 1 : 0, code).run();

  const updated: LinkRow = { ...link, destination, expires_at: expiresAt, disabled: disabled ? 1 : 0 };
  return json(publicRecord(updated, new URL(request.url).origin));
}

async function deleteLink(request: Request, code: string, env: Env): Promise<Response> {
  const link = await findLink(code, env);
  if (!link) return json({ error: "Link not found." }, 404);
  if (!await isLinkAuthorized(request, link, env)) return json({ error: "Invalid management code." }, 401);

  await env.DB.prepare("DELETE FROM links WHERE code = ?1").bind(code).run();
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function resolveLink(code: string, env: Env): Promise<Response> {
  if (!CODE_PATTERN.test(code)) return new Response("Link not found.", { status: 404 });

  const link = await findLink(code, env);
  if (!link || link.disabled) return new Response("Link not found.", { status: 404 });
  if (link.expires_at && Date.parse(link.expires_at) <= Date.now()) {
    return new Response("This short link has expired.", { status: 410 });
  }

  return Response.redirect(link.destination, 302);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method === "GET" && url.pathname === "/api/session") {
      return isCreatorAuthorized(request, env)
        ? json({ status: "ok" })
        : json({ error: "Invalid access code." }, 401);
    }
    if (request.method === "POST" && url.pathname === "/api/links") return createLink(request, env);
    if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok" });

    const managementMatch = url.pathname.match(/^\/api\/links\/([^/]+)$/);
    if (managementMatch) {
      const code = decodeURIComponent(managementMatch[1]);
      if (!CODE_PATTERN.test(code)) return json({ error: "Link not found." }, 404);
      if (request.method === "PATCH") return updateLink(request, code, env);
      if (request.method === "DELETE") return deleteLink(request, code, env);
    }

    const code = decodeURIComponent(url.pathname.slice(1));
    if (request.method === "GET" && code && !code.includes("/")) return resolveLink(code, env);

    return new Response("Not found.", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
