import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanUrl,
  createShortLink,
  deleteShortLink,
  testConnection,
  updateShortLink,
  type LinkRecord,
  type Settings
} from "../lib/shortener";

const settings: Settings = {
  serviceUrl: "https://links.example.test/",
  accessToken: "owner-token"
};

const record: LinkRecord = {
  code: "docs",
  shortUrl: "https://links.example.test/docs",
  destination: "https://example.com/old",
  createdAt: "2026-07-26T00:00:00.000Z",
  expiresAt: null,
  disabled: false,
  favorite: true,
  managementToken: "management-token-value",
  serviceUrl: "https://links.example.test"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cleanUrl", () => {
  it("removes common tracking parameters and preserves useful URL data", () => {
    const result = cleanUrl(
      "https://example.com/article?utm_source=newsletter&id=42&FBCLID=click#section"
    );

    expect(result).toEqual({
      url: "https://example.com/article?id=42#section",
      removed: 2
    });
  });

  it("leaves a clean URL unchanged", () => {
    expect(cleanUrl("https://example.com/search?q=linkwisp")).toEqual({
      url: "https://example.com/search?q=linkwisp",
      removed: 0
    });
  });

  it("rejects input that is not an absolute URL", () => {
    expect(() => cleanUrl("example.com/path")).toThrow();
  });
});

describe("connection and API helpers", () => {
  it("validates settings before contacting the Worker", async () => {
    await expect(testConnection({ ...settings, serviceUrl: "ftp://example.com" }))
      .rejects.toThrow("Enter a valid HTTP or HTTPS Worker address.");
    await expect(testConnection({ ...settings, accessToken: "" }))
      .rejects.toThrow("Enter the access code.");
  });

  it("tests a connection without creating a link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ status: "ok" })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(testConnection(settings)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://links.example.test/api/session",
      { headers: { Authorization: "Bearer owner-token" } }
    );
  });

  it("turns network and non-JSON responses into useful errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(testConnection(settings)).rejects.toThrow(
      "Could not reach the Worker. Check its address and confirm it is running."
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<html>wrong service</html>", { status: 502 })
    ));
    await expect(testConnection(settings)).rejects.toThrow(
      "The link service returned HTTP 502."
    );
  });

  it("creates a record and adds local-only fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      code: "launch",
      shortUrl: "https://links.example.test/launch",
      destination: "https://example.com/",
      createdAt: "2026-07-26T00:00:00.000Z",
      expiresAt: null,
      disabled: false,
      managementToken: "new-management-token"
    }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createShortLink(
      settings,
      "https://example.com/",
      "launch",
      null
    );

    expect(result.favorite).toBe(false);
    expect(result.serviceUrl).toBe("https://links.example.test");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://links.example.test/api/links",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer owner-token",
          "Content-Type": "application/json"
        }
      })
    );
  });

  it("uses the per-link management token for updates and preserves local state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      code: "docs",
      shortUrl: "https://links.example.test/docs",
      destination: "https://example.com/new",
      createdAt: record.createdAt,
      expiresAt: null,
      disabled: true
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateShortLink(settings, record, {
      destination: "https://example.com/new",
      disabled: true
    });

    expect(result).toMatchObject({
      destination: "https://example.com/new",
      disabled: true,
      favorite: true,
      managementToken: "management-token-value"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://links.example.test/api/links/docs",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          Authorization: "Bearer management-token-value",
          "Content-Type": "application/json"
        }
      })
    );
  });

  it("accepts a successful empty delete response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteShortLink(settings, record)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://links.example.test/api/links/docs",
      {
        method: "DELETE",
        headers: { Authorization: "Bearer management-token-value" }
      }
    );
  });

  it("surfaces a structured Worker error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ error: "That custom alias is already in use." }, { status: 409 })
    ));

    await expect(createShortLink(settings, "https://example.com", "docs"))
      .rejects.toThrow("That custom alias is already in use.");
  });
});
