import type { LinkRecord } from "./shortener";

export const BACKUP_FORMAT = "linkwisp-backup";
export const BACKUP_VERSION = 1;

export interface LinkWispBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  links: LinkRecord[];
}

interface ImportResult {
  records: LinkRecord[];
  added: number;
  updated: number;
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function httpUrl(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > 8192) {
    throw new Error(`${label} must be a valid HTTP or HTTPS URL.`);
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${label} must be a valid HTTP or HTTPS URL.`);
  }
}

function dateValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be a valid date.`);
  }
  return new Date(value).toISOString();
}

export function serviceAddress(value: unknown): string {
  const normalized = httpUrl(value, "Worker address");
  return normalized.replace(/\/$/, "");
}

export function recordKey(record: Pick<LinkRecord, "serviceUrl" | "code">): string {
  return JSON.stringify([record.serviceUrl, record.code]);
}

export function normalizeStoredRecord(value: unknown, fallbackServiceUrl = ""): LinkRecord | null {
  const record = objectValue(value);
  if (!record || typeof record.code !== "string" || !CODE_PATTERN.test(record.code)) return null;

  try {
    const shortUrl = httpUrl(record.shortUrl, "Short URL");
    const destination = httpUrl(record.destination, "Destination");
    const createdAt = dateValue(record.createdAt, "Creation date");
    const inferredServiceUrl = new URL(shortUrl).origin;
    const serviceUrl = serviceAddress(record.serviceUrl || fallbackServiceUrl || inferredServiceUrl);
    const expiresAt = record.expiresAt === null || record.expiresAt === undefined
      ? null
      : dateValue(record.expiresAt, "Expiration date");

    if (typeof record.disabled !== "boolean" && record.disabled !== undefined) return null;
    if (typeof record.favorite !== "boolean" && record.favorite !== undefined) return null;
    if (record.managementToken !== undefined && (
      typeof record.managementToken !== "string"
      || record.managementToken.length < 16
      || record.managementToken.length > 256
    )) return null;

    return {
      code: record.code,
      shortUrl,
      destination,
      createdAt,
      expiresAt,
      disabled: Boolean(record.disabled),
      favorite: Boolean(record.favorite),
      managementToken: record.managementToken as string | undefined,
      serviceUrl
    };
  } catch {
    return null;
  }
}

export function createBackup(records: LinkRecord[]): LinkWispBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    links: records
  };
}

export function parseBackup(text: string): LinkRecord[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This is not a valid JSON backup file.");
  }

  const backup = objectValue(value);
  if (!backup || backup.format !== BACKUP_FORMAT) {
    throw new Error("This file is not a LinkWisp backup.");
  }
  if (backup.version !== BACKUP_VERSION) {
    throw new Error(`Backup version ${String(backup.version)} is not supported.`);
  }
  if (typeof backup.exportedAt !== "string" || !Number.isFinite(Date.parse(backup.exportedAt))) {
    throw new Error("The backup export date is invalid.");
  }
  if (!Array.isArray(backup.links) || backup.links.length > 200) {
    throw new Error("The backup contains an invalid number of links.");
  }

  return backup.links.map((value, index) => {
    const record = normalizeStoredRecord(value);
    if (!record) throw new Error(`Link ${index + 1} in the backup is invalid.`);
    return record;
  });
}

export function mergeImportedRecords(current: LinkRecord[], imported: LinkRecord[]): ImportResult {
  const recordsByKey = new Map(current.map((record) => [recordKey(record), record]));
  let added = 0;
  let updated = 0;

  for (const incoming of imported) {
    const key = recordKey(incoming);
    const existing = recordsByKey.get(key);
    if (existing) {
      recordsByKey.set(key, {
        ...existing,
        ...incoming,
        favorite: incoming.favorite || existing.favorite,
        managementToken: incoming.managementToken || existing.managementToken
      });
      updated += 1;
    } else {
      recordsByKey.set(key, incoming);
      added += 1;
    }
  }

  return {
    records: [...recordsByKey.values()]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 200),
    added,
    updated
  };
}
