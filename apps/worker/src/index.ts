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
const TOKEN_ENCODER = new TextEncoder();

type RedirectStatus = "disabled" | "expired" | "missing";

const REDIRECT_STATUS_CONTENT: Record<RedirectStatus, {
  eyebrow: string;
  title: string;
  message: string;
  action: string | null;
}> = {
  disabled: {
    eyebrow: "Link paused",
    title: "This link is taking a break.",
    message: "The owner has temporarily disabled this LinkWisp link. It may become available again later.",
    action: "Try again"
  },
  expired: {
    eyebrow: "Link expired",
    title: "This link's time has passed.",
    message: "This LinkWisp link has reached its expiration date. Ask the sender for a fresh link.",
    action: null
  },
  missing: {
    eyebrow: "Link not found",
    title: "This Wisp has wandered off.",
    message: "Check the address for a typo, or ask the sender to confirm that the link still exists.",
    action: null
  }
};

const STATUS_PAGE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Content-Type": "text/html; charset=UTF-8",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow"
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

function redirectStatusPage(kind: RedirectStatus): Response {
  const content = REDIRECT_STATUS_CONTENT[kind];
  const status = kind === "expired" ? 410 : 404;
  const action = content.action
    ? `<a class="action" href="" aria-label="Try this short link again">${content.action}<span aria-hidden="true">&rarr;</span></a>`
    : "";

  return new Response(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <title>${content.eyebrow} | LinkWisp</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        overflow-x: hidden;
        background:
          radial-gradient(circle at 82% 12%, #8de0b24d 0, transparent 30rem),
          radial-gradient(circle at 10% 88%, #215f421c 0, transparent 28rem),
          #f4f7f2;
        color: #173326;
        padding: 28px 18px;
      }
      .glow {
        position: fixed;
        width: 220px;
        height: 220px;
        border-radius: 999px;
        background: #8de0b226;
        filter: blur(12px);
        pointer-events: none;
        animation: drift 7s ease-in-out infinite alternate;
      }
      .glow-one { top: -90px; right: -65px; }
      .glow-two { bottom: -110px; left: -70px; animation-delay: -3s; }
      main {
        position: relative;
        width: min(100%, 540px);
        border: 1px solid #d5e2d9;
        border-radius: 28px;
        background: #ffffffeb;
        box-shadow: 0 24px 70px #173b2824;
        padding: clamp(26px, 7vw, 48px);
        text-align: center;
        backdrop-filter: blur(12px);
        animation: arrive 420ms cubic-bezier(.2, .8, .2, 1) both;
      }
      .brand-mark {
        width: 72px;
        height: 72px;
        margin: 0 auto 24px;
        display: block;
        border-radius: 20px;
        box-shadow: 0 13px 32px #215f4230;
      }
      .eyebrow {
        margin: 0 0 9px;
        color: #397052;
        font-size: 12px;
        font-weight: 850;
        letter-spacing: .16em;
        text-transform: uppercase;
      }
      h1 { margin: 0; color: #173b28; font-size: clamp(29px, 7vw, 42px); letter-spacing: -.045em; line-height: 1.05; }
      .message { max-width: 410px; margin: 18px auto 0; color: #607168; font-size: 16px; line-height: 1.65; }
      .action {
        width: fit-content;
        margin: 27px auto 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        border: 1px solid #215f42;
        border-radius: 12px;
        background: linear-gradient(135deg, #215f42, #2f7753);
        color: white;
        font-weight: 780;
        padding: 11px 17px;
        text-decoration: none;
        transition: box-shadow 140ms ease, transform 100ms ease;
      }
      .action:hover { box-shadow: 0 9px 24px #215f4238; transform: translateY(-1px); }
      .action:active { transform: translateY(1px); }
      .action:focus-visible { outline: 3px solid #8de0b280; outline-offset: 3px; }
      .action span { transition: transform 140ms ease; }
      .action:hover span { transform: translateX(3px); }
      .signature { margin: 28px 0 0; color: #87938c; font-size: 12px; }
      .signature strong { color: #315d43; }
      @keyframes arrive { from { opacity: 0; transform: translateY(12px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes drift { to { transform: translate3d(14px, -10px, 0) scale(1.08); } }
      @media (prefers-color-scheme: dark) {
        :root { color-scheme: dark; }
        body { background: radial-gradient(circle at 82% 12%, #215f4266 0, transparent 30rem), #102219; color: #eaf3ed; }
        main { border-color: #365444; background: #173326e8; box-shadow: 0 24px 70px #06130c99; }
        h1 { color: #f4f7f2; }
        .eyebrow { color: #8de0b2; }
        .message { color: #b7c9be; }
        .signature { color: #8ea097; }
        .signature strong { color: #bde8cd; }
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
      }
    </style>
  </head>
  <body>
    <div class="glow glow-one" aria-hidden="true"></div>
    <div class="glow glow-two" aria-hidden="true"></div>
    <main aria-labelledby="status-title">
      <svg class="brand-mark" viewBox="0 0 128 128" role="img" aria-label="LinkWisp">
        <rect x="4" y="4" width="120" height="120" rx="30" fill="#215f42"/>
        <g transform="rotate(-32 64 61)" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <rect x="22" y="43" width="54" height="34" rx="17" stroke="#f4f7f2" stroke-width="10"/>
          <rect x="52" y="43" width="54" height="34" rx="17" stroke="#8de0b2" stroke-width="10"/>
        </g>
        <path d="M78 82c11 3 18 9 24 18" fill="none" stroke="#8de0b2" stroke-width="8" stroke-linecap="round"/>
        <circle cx="106" cy="105" r="5" fill="#f4f7f2"/>
      </svg>
      <p class="eyebrow">${content.eyebrow}</p>
      <h1 id="status-title">${content.title}</h1>
      <p class="message">${content.message}</p>
      ${action}
      <p class="signature">A short link powered by <strong>LinkWisp</strong></p>
    </main>
  </body>
</html>`, { status, headers: STATUS_PAGE_HEADERS });
}

function randomValue(length: number): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return [...values].map((value) => alphabet[value % alphabet.length]).join("");
}

async function hashToken(token: string): Promise<string> {
  const bytes = TOKEN_ENCODER.encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function timingSafeTokenMatch(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", TOKEN_ENCODER.encode(left)),
    crypto.subtle.digest("SHA-256", TOKEN_ENCODER.encode(right))
  ]);
  return crypto.subtle.timingSafeEqual(leftDigest, rightDigest);
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

function decodePathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

async function isCreatorAuthorized(request: Request, env: Env): Promise<boolean> {
  const token = bearerToken(request);
  if (!token || !env.ACCESS_TOKEN) return false;
  return timingSafeTokenMatch(token, env.ACCESS_TOKEN);
}

async function isLinkAuthorized(request: Request, link: LinkRow, env: Env): Promise<boolean> {
  const token = bearerToken(request);
  if (!token) return false;
  if (env.ACCESS_TOKEN && await timingSafeTokenMatch(token, env.ACCESS_TOKEN)) return true;
  if (!link.management_token_hash) return false;
  return timingSafeTokenMatch(await hashToken(token), link.management_token_hash);
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
  if (!await isCreatorAuthorized(request, env)) return json({ error: "Invalid access code." }, 401);

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
  if (!CODE_PATTERN.test(code)) return redirectStatusPage("missing");

  const link = await findLink(code, env);
  if (!link) return redirectStatusPage("missing");
  if (link.disabled) return redirectStatusPage("disabled");
  if (link.expires_at && Date.parse(link.expires_at) <= Date.now()) {
    return redirectStatusPage("expired");
  }

  return Response.redirect(link.destination, 302);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method === "GET" && url.pathname === "/api/session") {
      return await isCreatorAuthorized(request, env)
        ? json({ status: "ok" })
        : json({ error: "Invalid access code." }, 401);
    }
    if (request.method === "POST" && url.pathname === "/api/links") return createLink(request, env);
    if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok" });

    const managementMatch = url.pathname.match(/^\/api\/links\/([^/]+)$/);
    if (managementMatch) {
      const code = decodePathSegment(managementMatch[1]);
      if (!code || !CODE_PATTERN.test(code)) return json({ error: "Link not found." }, 404);
      if (request.method === "PATCH") return updateLink(request, code, env);
      if (request.method === "DELETE") return deleteLink(request, code, env);
    }

    const code = decodePathSegment(url.pathname.slice(1));
    if (request.method === "GET" && code === null && !url.pathname.slice(1).includes("/")) {
      return redirectStatusPage("missing");
    }
    if (request.method === "GET" && code && !code.includes("/")) return resolveLink(code, env);

    return new Response("Not found.", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
