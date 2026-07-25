import { describe, expect, it } from "vitest";
import { clearHistoryCopy } from "../lib/history-clear";

describe("clear-history confirmation copy", () => {
  it("uses singular wording for one record", () => {
    expect(clearHistoryCopy(1).heading).toBe("Clear 1 local link?");
  });

  it("uses plural wording and explains the local-only boundary", () => {
    expect(clearHistoryCopy(12)).toEqual({
      heading: "Clear 12 local links?",
      explanation: "This removes history and link-management keys from this browser only. Your online short links will remain active."
    });
  });
});
