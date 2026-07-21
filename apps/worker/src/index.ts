interface Env {
  DB: D1Database;
  ACCESS_TOKEN: string;
}

interface CreateLinkBody {
  destination?: unknown;
  customCode?: unknown;
  expiresAt?: unknown;
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

function randomCode(length = 7): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return [...values].map((value) => alphabet[value % alphabet.length]).join("");
}

function isAuthorized(request: Request, env: Env): boolean {
  const authorization = request.headers.get("Authorization");
  return Boolean(env.ACCESS_TOKEN) && authorization === `Bearer ${env.ACCESS_TOKEN}`;
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

async function createLink(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return json({ error: "Invalid access code." }, 401);

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
    return json({ error: "Alias must be 3–32 letters, numbers, hyphens, or underscores." }, 400);
  }

  let expiresAt: string | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    if (typeof body.expiresAt !== "string" || !Number.isFinite(Date.parse(body.expiresAt))) {
      return json({ error: "Expiration must be a valid date." }, 400);
    }
    expiresAt = new Date(body.expiresAt).toISOString();
    if (Date.parse(expiresAt) <= Date.now()) {
      return json({ error: "Expiration must be in the future." }, 400);
    }
  }
  const origin = new URL(request.url).origin;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = requestedCode || randomCode();
    const createdAt = new Date().toISOString();
    const result = await env.DB.prepare(
      "INSERT OR IGNORE INTO links (code, destination, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)"
    ).bind(code, destination, createdAt, expiresAt).run();

    if (result.meta.changes > 0) {
      return json({ code, destination, shortUrl: `${origin}/${code}`, createdAt }, 201);
    }

    if (requestedCode) return json({ error: "That custom alias is already in use." }, 409);
  }

  return json({ error: "Could not allocate a short code. Try again." }, 503);
}

async function resolveLink(code: string, env: Env): Promise<Response> {
  if (!CODE_PATTERN.test(code)) return new Response("Link not found.", { status: 404 });

  const link = await env.DB.prepare(
    "SELECT destination, expires_at, disabled FROM links WHERE code = ?1"
  ).bind(code).first<{ destination: string; expires_at: string | null; disabled: number }>();

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
    if (request.method === "POST" && url.pathname === "/api/links") return createLink(request, env);
    if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok" });

    const code = decodeURIComponent(url.pathname.slice(1));
    if (request.method === "GET" && code && !code.includes("/")) return resolveLink(code, env);

    return new Response("Not found.", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
