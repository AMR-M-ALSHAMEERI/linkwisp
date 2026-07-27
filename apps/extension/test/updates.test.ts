import { describe, expect, it, vi } from "vitest";
import {
  UPDATE_CACHE_TTL_MS,
  checkForUpdate,
  compareVersions,
  freshUpdateCache,
  hasFirefoxUpdateDataPermission,
  normalizeManifestVersion,
  normalizeReleaseTag,
  normalizeUpdateCache,
  updateCache,
  updatePlatform,
  validateFirefoxRelease,
  validateLatestRelease,
  type UpdateResult
} from "../lib/updates";

const checkedAt = Date.parse("2026-07-28T00:00:00.000Z");

function latestRelease(version = "0.3.0", overrides: Record<string, unknown> = {}) {
  return {
    tag_name: `v${version}`,
    html_url: `https://github.com/AMR-M-ALSHAMEERI/linkwisp/releases/tag/v${version}`,
    draft: false,
    prerelease: false,
    published_at: "2026-07-28T00:00:00Z",
    ...overrides
  };
}

function firefoxRelease(version = "0.3.0", overrides: Record<string, unknown> = {}) {
  return {
    tag_name: `firefox-v${version}`,
    html_url: `https://github.com/AMR-M-ALSHAMEERI/linkwisp/releases/tag/firefox-v${version}`,
    draft: false,
    prerelease: false,
    published_at: "2026-07-28T00:00:00Z",
    ...overrides
  };
}

function response(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

describe("semantic version handling", () => {
  it("normalizes installed versions and stable release tags", () => {
    expect(normalizeManifestVersion("0.3.0")).toBe("0.3.0");
    expect(normalizeReleaseTag("v0.3.0")).toBe("0.3.0");
    expect(normalizeManifestVersion("v0.3.0")).toBeNull();
    expect(normalizeReleaseTag("0.3.0")).toBeNull();
    expect(normalizeReleaseTag("v0.3.0-beta.1")).toBeNull();
    expect(normalizeReleaseTag("v01.3.0")).toBeNull();
  });

  it("compares patch, minor, and major versions numerically", () => {
    expect(compareVersions("0.2.0", "0.2.0")).toBe(0);
    expect(compareVersions("0.2.0", "0.2.1")).toBe(-1);
    expect(compareVersions("0.2.9", "0.3.0")).toBe(-1);
    expect(compareVersions("1.0.0", "0.9.9")).toBe(1);
  });

  it("rejects malformed comparison input", () => {
    expect(() => compareVersions("0.3", "0.3.0")).toThrow(
      "Version values must use major.minor.patch."
    );
  });
});

describe("release validation", () => {
  it("accepts only the exact official stable release URL", () => {
    expect(validateLatestRelease(latestRelease())).toEqual({
      version: "0.3.0",
      releaseUrl: "https://github.com/AMR-M-ALSHAMEERI/linkwisp/releases/tag/v0.3.0",
      publishedAt: "2026-07-28T00:00:00.000Z"
    });
    expect(validateLatestRelease(latestRelease("0.3.0", { draft: true }))).toBeNull();
    expect(validateLatestRelease(latestRelease("0.3.0", { prerelease: true }))).toBeNull();
    expect(validateLatestRelease(latestRelease("0.3.0", {
      html_url: "https://example.com/releases/tag/v0.3.0"
    }))).toBeNull();
  });

  it("accepts only the matching official signed Firefox release", () => {
    expect(validateFirefoxRelease(firefoxRelease(), "0.3.0")?.releaseUrl)
      .toBe("https://github.com/AMR-M-ALSHAMEERI/linkwisp/releases/tag/firefox-v0.3.0");
    expect(validateFirefoxRelease(firefoxRelease("0.3.1"), "0.3.0")).toBeNull();
    expect(validateFirefoxRelease(firefoxRelease("0.3.0", {
      html_url: "https://github.com/other/repository/releases/tag/firefox-v0.3.0"
    }), "0.3.0")).toBeNull();
  });

  it("maps Manifest V2 to Firefox and Manifest V3 to Chrome", () => {
    expect(updatePlatform(2)).toBe("firefox");
    expect(updatePlatform(3)).toBe("chrome");
  });

  it("detects Firefox's optional technical and interaction consent", () => {
    expect(hasFirefoxUpdateDataPermission({
      data_collection: ["technicalAndInteraction"]
    })).toBe(true);
    expect(hasFirefoxUpdateDataPermission({ data_collection: [] })).toBe(false);
    expect(hasFirefoxUpdateDataPermission({})).toBe(false);
  });
});

describe("GitHub update checks", () => {
  it("returns current for an equal or older stable release", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(latestRelease("0.2.0")));
    await expect(checkForUpdate({
      installedVersion: "0.3.0",
      platform: "chrome",
      now: checkedAt,
      fetcher
    })).resolves.toMatchObject({
      kind: "current",
      installedVersion: "0.3.0",
      latestVersion: "0.2.0"
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("routes Chrome to the normal stable release", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(latestRelease()));
    await expect(checkForUpdate({
      installedVersion: "0.2.0",
      platform: "chrome",
      now: checkedAt,
      fetcher
    })).resolves.toEqual({
      kind: "available",
      installedVersion: "0.2.0",
      latestVersion: "0.3.0",
      releaseUrl: "https://github.com/AMR-M-ALSHAMEERI/linkwisp/releases/tag/v0.3.0",
      checkedAt,
      platform: "chrome"
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("requires and routes Firefox to its matching signed release", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(latestRelease()))
      .mockResolvedValueOnce(response(firefoxRelease()));
    const result = await checkForUpdate({
      installedVersion: "0.2.0",
      platform: "firefox",
      now: checkedAt,
      fetcher
    });

    expect(result).toEqual({
      kind: "available",
      installedVersion: "0.2.0",
      latestVersion: "0.3.0",
      releaseUrl: "https://github.com/AMR-M-ALSHAMEERI/linkwisp/releases/tag/firefox-v0.3.0",
      checkedAt,
      platform: "firefox"
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/AMR-M-ALSHAMEERI/linkwisp/releases/tags/firefox-v0.3.0",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("does not announce Firefox before the matching signed release exists", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(latestRelease()))
      .mockResolvedValueOnce(response({ message: "Not Found" }, 404));
    await expect(checkForUpdate({
      installedVersion: "0.2.0",
      platform: "firefox",
      now: checkedAt,
      fetcher
    })).resolves.toMatchObject({
      kind: "unavailable",
      latestVersion: "0.3.0",
      platform: "firefox"
    });
  });

  it("rejects rate limits, malformed JSON, and suspicious metadata safely", async () => {
    const rateLimited = vi.fn().mockResolvedValue(response({ message: "rate limited" }, 403));
    await expect(checkForUpdate({
      installedVersion: "0.2.0",
      platform: "chrome",
      now: checkedAt,
      fetcher: rateLimited
    })).resolves.toMatchObject({ kind: "unavailable" });

    const suspicious = vi.fn().mockResolvedValue(response(latestRelease("0.3.0", {
      html_url: "https://attacker.example/update"
    })));
    await expect(checkForUpdate({
      installedVersion: "0.2.0",
      platform: "chrome",
      now: checkedAt,
      fetcher: suspicious
    })).resolves.toMatchObject({ kind: "unavailable" });
  });

  it("aborts a request after the configured timeout", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
    );

    await expect(checkForUpdate({
      installedVersion: "0.2.0",
      platform: "chrome",
      fetcher,
      timeoutMs: 1
    })).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("local update cache", () => {
  const available: UpdateResult = {
    kind: "available",
    installedVersion: "0.2.0",
    latestVersion: "0.3.0",
    releaseUrl: "https://github.com/AMR-M-ALSHAMEERI/linkwisp/releases/tag/v0.3.0",
    checkedAt,
    platform: "chrome"
  };

  it("accepts a fresh matching cache and rejects it after 24 hours", () => {
    const cache = updateCache(available);
    expect(freshUpdateCache(cache, "0.2.0", "chrome", checkedAt + UPDATE_CACHE_TTL_MS - 1))
      .toEqual(cache);
    expect(freshUpdateCache(cache, "0.2.0", "chrome", checkedAt + UPDATE_CACHE_TTL_MS))
      .toBeNull();
  });

  it("rejects caches for another installed version, platform, or URL", () => {
    const cache = updateCache(available);
    expect(normalizeUpdateCache(cache, "0.3.0", "chrome")).toBeNull();
    expect(normalizeUpdateCache(cache, "0.2.0", "firefox")).toBeNull();
    expect(normalizeUpdateCache({
      ...cache,
      releaseUrl: "https://example.com/update"
    }, "0.2.0", "chrome")).toBeNull();
  });

  it("keeps a validated unavailable result cacheable without a release URL", () => {
    const cache = updateCache({
      kind: "unavailable",
      installedVersion: "0.2.0",
      latestVersion: "0.3.0",
      checkedAt,
      platform: "firefox"
    });
    expect(normalizeUpdateCache(cache, "0.2.0", "firefox")).toEqual(cache);
  });
});
