import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createBackup,
  mergeImportedRecords,
  normalizeStoredRecord,
  parseBackup,
  recordKey,
  serviceAddress
} from "../lib/backup";
import type { LinkRecord } from "../lib/shortener";

function link(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    code: "docs",
    shortUrl: "https://links.example.test/docs",
    destination: "https://example.com/docs",
    createdAt: "2026-07-26T00:00:00.000Z",
    expiresAt: null,
    disabled: false,
    favorite: false,
    managementToken: "management-token-value",
    serviceUrl: "https://links.example.test",
    ...overrides
  };
}

describe("stored record normalization", () => {
  it("normalizes URLs, dates, defaults, and an inferred service address", () => {
    const normalized = normalizeStoredRecord({
      code: "abc_123",
      shortUrl: "https://short.example/abc_123",
      destination: "https://example.com",
      createdAt: "2026-07-26",
      expiresAt: undefined
    });

    expect(normalized).toEqual({
      code: "abc_123",
      shortUrl: "https://short.example/abc_123",
      destination: "https://example.com/",
      createdAt: "2026-07-26T00:00:00.000Z",
      expiresAt: null,
      disabled: false,
      favorite: false,
      managementToken: undefined,
      serviceUrl: "https://short.example"
    });
  });

  it("rejects invalid aliases, protocols, flags, and management tokens", () => {
    expect(normalizeStoredRecord({ ...link(), code: "x" })).toBeNull();
    expect(normalizeStoredRecord({ ...link(), destination: "javascript:alert(1)" })).toBeNull();
    expect(normalizeStoredRecord({ ...link(), disabled: "yes" })).toBeNull();
    expect(normalizeStoredRecord({ ...link(), managementToken: "short" })).toBeNull();
  });

  it("normalizes service addresses and builds collision-safe record keys", () => {
    expect(serviceAddress("https://links.example.test/")).toBe("https://links.example.test");
    expect(() => serviceAddress("file:///tmp/linkwisp")).toThrow(
      "Worker address must be a valid HTTP or HTTPS URL."
    );
    expect(recordKey(link())).not.toBe(recordKey(link({
      serviceUrl: "https://other.example.test"
    })));
  });
});

describe("backup format", () => {
  it("creates a versioned backup that can be parsed", () => {
    const records = [link()];
    const backup = createBackup(records);

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(Number.isFinite(Date.parse(backup.exportedAt))).toBe(true);
    expect(parseBackup(JSON.stringify(backup))).toEqual(records);
  });

  it("rejects malformed, unrelated, unsupported, or oversized backups", () => {
    expect(() => parseBackup("{")).toThrow("This is not a valid JSON backup file.");
    expect(() => parseBackup(JSON.stringify({ format: "other" })))
      .toThrow("This file is not a LinkWisp backup.");
    expect(() => parseBackup(JSON.stringify({
      format: BACKUP_FORMAT,
      version: 99,
      exportedAt: new Date().toISOString(),
      links: []
    }))).toThrow("Backup version 99 is not supported.");
    expect(() => parseBackup(JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      links: Array.from({ length: 201 }, () => link())
    }))).toThrow("The backup contains an invalid number of links.");
  });

  it("rejects the entire backup when any record is invalid", () => {
    expect(() => parseBackup(JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      links: [link(), { ...link(), code: "no" }]
    }))).toThrow("Link 2 in the backup is invalid.");
  });
});

describe("import merging", () => {
  it("adds new mappings, updates matching mappings, and preserves useful local state", () => {
    const current = [
      link({ favorite: true }),
      link({
        code: "old",
        shortUrl: "https://links.example.test/old",
        createdAt: "2026-07-20T00:00:00.000Z"
      })
    ];
    const imported = [
      link({
        destination: "https://example.com/updated",
        favorite: false,
        managementToken: undefined
      }),
      link({
        code: "new",
        shortUrl: "https://links.example.test/new",
        createdAt: "2026-07-27T00:00:00.000Z"
      })
    ];

    const result = mergeImportedRecords(current, imported);

    expect(result).toMatchObject({ added: 1, updated: 1 });
    expect(result.records.map((record) => record.code)).toEqual(["new", "docs", "old"]);
    expect(result.records[1]).toMatchObject({
      destination: "https://example.com/updated",
      favorite: true,
      managementToken: "management-token-value"
    });
  });

  it("caps merged history at 200 newest records", () => {
    const imported = Array.from({ length: 205 }, (_, index) => link({
      code: `code-${index}`,
      shortUrl: `https://links.example.test/code-${index}`,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString()
    }));

    const result = mergeImportedRecords([], imported);
    expect(result.added).toBe(205);
    expect(result.records).toHaveLength(200);
    expect(result.records[0].code).toBe("code-204");
  });
});
