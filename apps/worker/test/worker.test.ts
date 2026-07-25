import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const ORIGIN = "https://links.example.test";
const OWNER_HEADERS = {
  Authorization: "Bearer linkwisp-test-owner-token",
  "Content-Type": "application/json"
};

async function call(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(`${ORIGIN}${path}`, {
    ...init,
    redirect: "manual"
  });
}

async function create(
  code: string,
  overrides: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const response = await call("/api/links", {
    method: "POST",
    headers: OWNER_HEADERS,
    body: JSON.stringify({
      destination: `https://example.com/${code}`,
      customCode: code,
      ...overrides
    })
  });
  expect(response.status).toBe(201);
  return response.json<Record<string, unknown>>();
}

describe("service and authorization", () => {
  it("exposes health, authenticated session, and CORS preflight responses", async () => {
    const health = await call("/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const unauthorized = await call("/api/session");
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ error: "Invalid access code." });

    const authorized = await call("/api/session", {
      headers: { Authorization: OWNER_HEADERS.Authorization }
    });
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toEqual({ status: "ok" });

    const preflight = await call("/api/links", { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects missing credentials and malformed request bodies", async () => {
    const unauthorized = await call("/api/links", {
      method: "POST",
      body: JSON.stringify({ destination: "https://example.com" })
    });
    expect(unauthorized.status).toBe(401);

    const malformed = await call("/api/links", {
      method: "POST",
      headers: OWNER_HEADERS,
      body: "{"
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({
      error: "Request body must be valid JSON."
    });
  });
});

describe("creation validation", () => {
  it("creates random and custom aliases with one-time management tokens", async () => {
    const custom = await create("create-custom");
    expect(custom).toMatchObject({
      code: "create-custom",
      destination: "https://example.com/create-custom",
      shortUrl: `${ORIGIN}/create-custom`,
      disabled: false,
      expiresAt: null
    });
    expect(custom.managementToken).toEqual(expect.any(String));
    expect((custom.managementToken as string).length).toBe(40);

    const randomResponse = await call("/api/links", {
      method: "POST",
      headers: OWNER_HEADERS,
      body: JSON.stringify({ destination: "https://example.com/random" })
    });
    expect(randomResponse.status).toBe(201);
    const random = await randomResponse.json<{ code: string }>();
    expect(random.code).toMatch(/^[A-Za-z0-9_-]{7}$/);
  });

  it("rejects invalid destinations, aliases, expirations, and duplicate aliases", async () => {
    const invalidDestination = await call("/api/links", {
      method: "POST",
      headers: OWNER_HEADERS,
      body: JSON.stringify({ destination: "javascript:alert(1)" })
    });
    expect(invalidDestination.status).toBe(400);

    const invalidAlias = await call("/api/links", {
      method: "POST",
      headers: OWNER_HEADERS,
      body: JSON.stringify({
        destination: "https://example.com",
        customCode: "no spaces"
      })
    });
    expect(invalidAlias.status).toBe(400);

    const pastExpiration = await call("/api/links", {
      method: "POST",
      headers: OWNER_HEADERS,
      body: JSON.stringify({
        destination: "https://example.com",
        customCode: "past-expiry",
        expiresAt: "2020-01-01T00:00:00.000Z"
      })
    });
    expect(pastExpiration.status).toBe(400);

    await create("duplicate-alias");
    const duplicate = await call("/api/links", {
      method: "POST",
      headers: OWNER_HEADERS,
      body: JSON.stringify({
        destination: "https://example.com/second",
        customCode: "duplicate-alias"
      })
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({
      error: "That custom alias is already in use."
    });
  });
});

describe("redirect and lifecycle behavior", () => {
  it("redirects an active link with a temporary status", async () => {
    await create("active-link");
    const response = await call("/active-link");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://example.com/active-link");
  });

  it("lets a per-link token edit, disable, and re-enable its mapping", async () => {
    const created = await create("managed-link");
    const managementToken = created.managementToken as string;

    const invalidToken = await call("/api/links/managed-link", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer wrong-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ disabled: true })
    });
    expect(invalidToken.status).toBe(401);

    const updated = await call("/api/links/managed-link", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        destination: "https://example.org/updated",
        disabled: true
      })
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      destination: "https://example.org/updated",
      disabled: true
    });

    const disabled = await call("/managed-link");
    expect(disabled.status).toBe(404);
    expect(await disabled.text()).toContain("This link is taking a break.");

    const enabled = await call("/api/links/managed-link", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ disabled: false })
    });
    expect(enabled.status).toBe(200);

    const redirect = await call("/managed-link");
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("Location")).toBe("https://example.org/updated");
  });

  it("returns branded, private pages for expired and missing links", async () => {
    await create("expired-link");
    await env.DB.prepare(
      "UPDATE links SET expires_at = ?1 WHERE code = ?2"
    ).bind("2020-01-01T00:00:00.000Z", "expired-link").run();

    const expired = await call("/expired-link");
    const expiredHtml = await expired.text();
    expect(expired.status).toBe(410);
    expect(expiredHtml).toContain("This link's time has passed.");
    expect(expiredHtml).not.toContain("https://example.com/expired-link");
    expect(expired.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");

    const missing = await call("/never-created");
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("This Wisp has wandered off.");
  });

  it("deletes with a per-link token and allows the owner token as a recovery fallback", async () => {
    const first = await create("delete-token");
    const deletedByToken = await call("/api/links/delete-token", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${String(first.managementToken)}` }
    });
    expect(deletedByToken.status).toBe(204);
    expect((await call("/delete-token")).status).toBe(404);

    await create("delete-owner");
    const deletedByOwner = await call("/api/links/delete-owner", {
      method: "DELETE",
      headers: { Authorization: OWNER_HEADERS.Authorization }
    });
    expect(deletedByOwner.status).toBe(204);
  });

  it("validates lifecycle payloads and unknown mappings", async () => {
    await create("invalid-update");

    const empty = await call("/api/links/invalid-update", {
      method: "PATCH",
      headers: OWNER_HEADERS,
      body: "{}"
    });
    expect(empty.status).toBe(400);

    const invalidDisabled = await call("/api/links/invalid-update", {
      method: "PATCH",
      headers: OWNER_HEADERS,
      body: JSON.stringify({ disabled: "yes" })
    });
    expect(invalidDisabled.status).toBe(400);

    const missing = await call("/api/links/unknown-link", {
      method: "DELETE",
      headers: { Authorization: OWNER_HEADERS.Authorization }
    });
    expect(missing.status).toBe(404);
  });
});
