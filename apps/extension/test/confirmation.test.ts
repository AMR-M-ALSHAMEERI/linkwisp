import { describe, expect, it } from "vitest";
import {
  clearHistoryConfirmation,
  deleteLinkConfirmation
} from "../lib/confirmation";

describe("clear-history confirmation copy", () => {
  it("uses singular wording for one record", () => {
    expect(clearHistoryConfirmation(1).heading).toBe("Clear 1 local link?");
  });

  it("uses plural wording and explains the local-only boundary", () => {
    expect(clearHistoryConfirmation(12)).toEqual({
      eyebrow: "LOCAL HISTORY",
      heading: "Clear 12 local links?",
      explanation: "This removes history and link-management keys from this browser only. Your online short links will remain active.",
      warning: "This cannot be undone unless you exported a backup.",
      confirmLabel: "Clear history"
    });
  });
});

describe("delete-link confirmation copy", () => {
  it("distinguishes permanent online deletion from local clearing", () => {
    expect(deleteLinkConfirmation("https://example.workers.dev/demo")).toEqual({
      eyebrow: "ONLINE LINK",
      heading: "Delete this short link?",
      explanation: "https://example.workers.dev/demo will stop redirecting for everyone. Its local record is removed only after the service confirms deletion.",
      warning: "This permanently removes the online mapping and cannot be undone.",
      confirmLabel: "Delete link"
    });
  });
});
