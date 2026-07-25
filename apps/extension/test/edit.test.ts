import { describe, expect, it } from "vitest";
import {
  buildEditLinkChanges,
  editExpirationValue
} from "../lib/edit";

const NOW = Date.parse("2026-07-26T00:00:00.000Z");
const record = {
  destination: "https://example.com/original",
  expiresAt: "2026-08-01T00:00:00.000Z"
};

describe("editExpirationValue", () => {
  it("preserves or removes expiration explicitly", () => {
    expect(editExpirationValue("keep", "", NOW)).toBeUndefined();
    expect(editExpirationValue("never", "", NOW)).toBeNull();
  });

  it("creates deterministic preset expirations", () => {
    expect(editExpirationValue("hour", "", NOW)).toBe("2026-07-26T01:00:00.000Z");
    expect(editExpirationValue("day", "", NOW)).toBe("2026-07-27T00:00:00.000Z");
    expect(editExpirationValue("week", "", NOW)).toBe("2026-08-02T00:00:00.000Z");
  });

  it("normalizes a future custom expiration", () => {
    expect(editExpirationValue("custom", "2026-07-30T12:30:00.000Z", NOW))
      .toBe("2026-07-30T12:30:00.000Z");
  });

  it("rejects invalid or past custom expirations", () => {
    expect(() => editExpirationValue("custom", "", NOW))
      .toThrow("Choose a custom expiration in the future.");
    expect(() => editExpirationValue("custom", "2020-01-01", NOW))
      .toThrow("Choose a custom expiration in the future.");
  });
});

describe("buildEditLinkChanges", () => {
  it("cleans a changed destination while keeping the current expiration", () => {
    expect(buildEditLinkChanges(
      record,
      " https://example.org/new?utm_source=test&id=42 ",
      "keep",
      "",
      NOW
    )).toEqual({
      update: {
        destination: "https://example.org/new?id=42"
      },
      removedTrackingParameters: 1
    });
  });

  it("can update only the expiration", () => {
    expect(buildEditLinkChanges(
      record,
      record.destination,
      "never",
      "",
      NOW
    )).toEqual({
      update: { expiresAt: null },
      removedTrackingParameters: 0
    });
  });

  it("can update destination and expiration together", () => {
    expect(buildEditLinkChanges(
      record,
      "https://example.net/next",
      "custom",
      "2026-09-01T00:00:00.000Z",
      NOW
    )).toEqual({
      update: {
        destination: "https://example.net/next",
        expiresAt: "2026-09-01T00:00:00.000Z"
      },
      removedTrackingParameters: 0
    });
  });

  it("rejects empty, relative, and unsafe destinations", () => {
    expect(() => buildEditLinkChanges(record, "", "keep", "", NOW))
      .toThrow("Enter a destination URL.");
    expect(() => buildEditLinkChanges(record, "example.com", "keep", "", NOW))
      .toThrow("Enter a valid HTTP or HTTPS destination.");
    expect(() => buildEditLinkChanges(record, "javascript:alert(1)", "keep", "", NOW))
      .toThrow("Enter a valid HTTP or HTTPS destination.");
  });

  it("requires at least one effective change", () => {
    expect(() => buildEditLinkChanges(
      record,
      record.destination,
      "keep",
      "",
      NOW
    )).toThrow("Make at least one change before saving.");
  });
});
