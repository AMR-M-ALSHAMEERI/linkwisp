export const UPDATE_CACHE_KEY = "releaseUpdateCache";
export const UPDATE_CACHE_VERSION = 1;
export const UPDATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_REQUEST_TIMEOUT_MS = 6_000;

const REPOSITORY_PATH = "AMR-M-ALSHAMEERI/linkwisp";
const RELEASES_BASE_URL = `https://github.com/${REPOSITORY_PATH}/releases/tag/`;
const API_BASE_URL = `https://api.github.com/repos/${REPOSITORY_PATH}/releases`;
const LATEST_RELEASE_API_URL = `${API_BASE_URL}/latest`;

export type UpdatePlatform = "chrome" | "firefox";
export type UpdateResultKind = "current" | "available" | "unavailable";
export const FIREFOX_UPDATE_DATA_PERMISSION = "technicalAndInteraction";

export interface StableRelease {
  version: string;
  releaseUrl: string;
  publishedAt?: string;
}

export interface UpdateResult {
  kind: UpdateResultKind;
  installedVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  checkedAt: number;
  platform: UpdatePlatform;
}

export interface UpdateCache extends UpdateResult {
  cacheVersion: typeof UPDATE_CACHE_VERSION;
}

interface NumericVersion {
  major: number;
  minor: number;
  patch: number;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function hasFirefoxUpdateDataPermission(value: unknown): boolean {
  const permissions = objectValue(value);
  return Array.isArray(permissions?.data_collection)
    && permissions.data_collection.includes(FIREFOX_UPDATE_DATA_PERMISSION);
}

function numericVersion(value: string): NumericVersion | null {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) return null;

  const version = {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };

  return Object.values(version).every(Number.isSafeInteger) ? version : null;
}

export function normalizeManifestVersion(value: string): string | null {
  return numericVersion(value) ? value : null;
}

export function normalizeReleaseTag(value: string): string | null {
  return value.startsWith("v") && numericVersion(value.slice(1))
    ? value.slice(1)
    : null;
}

export function compareVersions(left: string, right: string): number {
  const leftVersion = numericVersion(left);
  const rightVersion = numericVersion(right);
  if (!leftVersion || !rightVersion) throw new Error("Version values must use major.minor.patch.");

  for (const key of ["major", "minor", "patch"] as const) {
    if (leftVersion[key] !== rightVersion[key]) {
      return leftVersion[key] < rightVersion[key] ? -1 : 1;
    }
  }
  return 0;
}

function validPublishedAt(value: unknown): string | undefined {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
}

export function validateLatestRelease(value: unknown): StableRelease | null {
  const release = objectValue(value);
  if (!release || release.draft !== false || release.prerelease !== false) return null;
  if (typeof release.tag_name !== "string" || typeof release.html_url !== "string") return null;

  const version = normalizeReleaseTag(release.tag_name);
  if (!version) return null;
  const expectedUrl = `${RELEASES_BASE_URL}v${version}`;
  if (release.html_url !== expectedUrl) return null;

  return {
    version,
    releaseUrl: expectedUrl,
    publishedAt: validPublishedAt(release.published_at)
  };
}

export function validateFirefoxRelease(value: unknown, version: string): StableRelease | null {
  if (!numericVersion(version)) return null;
  const release = objectValue(value);
  if (!release || release.draft !== false || release.prerelease !== false) return null;

  const expectedTag = `firefox-v${version}`;
  const expectedUrl = `${RELEASES_BASE_URL}${expectedTag}`;
  if (release.tag_name !== expectedTag || release.html_url !== expectedUrl) return null;

  return {
    version,
    releaseUrl: expectedUrl,
    publishedAt: validPublishedAt(release.published_at)
  };
}

export function updatePlatform(manifestVersion: number): UpdatePlatform {
  return manifestVersion === 2 ? "firefox" : "chrome";
}

function normalizeCheckedAt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function normalizeUpdateCache(
  value: unknown,
  installedVersion: string,
  platform: UpdatePlatform
): UpdateCache | null {
  const cache = objectValue(value);
  if (!cache || cache.cacheVersion !== UPDATE_CACHE_VERSION) return null;
  if (cache.installedVersion !== installedVersion || cache.platform !== platform) return null;
  if (cache.kind !== "current" && cache.kind !== "available" && cache.kind !== "unavailable") return null;

  const checkedAt = normalizeCheckedAt(cache.checkedAt);
  if (checkedAt === null) return null;

  const latestVersion = typeof cache.latestVersion === "string"
    ? normalizeManifestVersion(cache.latestVersion) ?? undefined
    : undefined;
  const releaseUrl = typeof cache.releaseUrl === "string" ? cache.releaseUrl : undefined;

  if (cache.kind === "available") {
    if (!latestVersion || compareVersions(installedVersion, latestVersion) >= 0) return null;
    const expectedUrl = platform === "firefox"
      ? `${RELEASES_BASE_URL}firefox-v${latestVersion}`
      : `${RELEASES_BASE_URL}v${latestVersion}`;
    if (releaseUrl !== expectedUrl) return null;
  }

  if (cache.kind === "current" && latestVersion && compareVersions(installedVersion, latestVersion) < 0) {
    return null;
  }

  return {
    cacheVersion: UPDATE_CACHE_VERSION,
    kind: cache.kind,
    installedVersion,
    latestVersion,
    releaseUrl: cache.kind === "available" ? releaseUrl : undefined,
    checkedAt,
    platform
  };
}

export function freshUpdateCache(
  value: unknown,
  installedVersion: string,
  platform: UpdatePlatform,
  now = Date.now()
): UpdateCache | null {
  const cache = normalizeUpdateCache(value, installedVersion, platform);
  if (!cache || now - cache.checkedAt < 0 || now - cache.checkedAt >= UPDATE_CACHE_TTL_MS) return null;
  return cache;
}

function requestHeaders(): HeadersInit {
  return {
    Accept: "application/vnd.github+json"
  };
}

async function fetchJson(
  url: string,
  fetcher: Fetcher,
  timeoutMs: number
): Promise<{ response: Response; value?: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: requestHeaders(),
      signal: controller.signal
    });
    if (!response.ok) return { response };
    try {
      return { response, value: await response.json() };
    } catch {
      return { response };
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkForUpdate(options: {
  installedVersion: string;
  platform: UpdatePlatform;
  now?: number;
  fetcher?: Fetcher;
  timeoutMs?: number;
}): Promise<UpdateResult> {
  const installedVersion = normalizeManifestVersion(options.installedVersion);
  if (!installedVersion) throw new Error("The installed extension version is invalid.");

  const now = options.now ?? Date.now();
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? UPDATE_REQUEST_TIMEOUT_MS;

  const latestResponse = await fetchJson(LATEST_RELEASE_API_URL, fetcher, timeoutMs);
  const latest = latestResponse.response.ok
    ? validateLatestRelease(latestResponse.value)
    : null;
  if (!latest) {
    return {
      kind: "unavailable",
      installedVersion,
      checkedAt: now,
      platform: options.platform
    };
  }

  if (compareVersions(installedVersion, latest.version) >= 0) {
    return {
      kind: "current",
      installedVersion,
      latestVersion: latest.version,
      checkedAt: now,
      platform: options.platform
    };
  }

  if (options.platform === "chrome") {
    return {
      kind: "available",
      installedVersion,
      latestVersion: latest.version,
      releaseUrl: latest.releaseUrl,
      checkedAt: now,
      platform: options.platform
    };
  }

  const firefoxTag = `firefox-v${latest.version}`;
  const firefoxResponse = await fetchJson(
    `${API_BASE_URL}/tags/${firefoxTag}`,
    fetcher,
    timeoutMs
  );
  const firefoxRelease = firefoxResponse.response.ok
    ? validateFirefoxRelease(firefoxResponse.value, latest.version)
    : null;

  return firefoxRelease
    ? {
        kind: "available",
        installedVersion,
        latestVersion: latest.version,
        releaseUrl: firefoxRelease.releaseUrl,
        checkedAt: now,
        platform: options.platform
      }
    : {
        kind: "unavailable",
        installedVersion,
        latestVersion: latest.version,
        checkedAt: now,
        platform: options.platform
      };
}

export function updateCache(result: UpdateResult): UpdateCache {
  return {
    cacheVersion: UPDATE_CACHE_VERSION,
    ...result
  };
}
