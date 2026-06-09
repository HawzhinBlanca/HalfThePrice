import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  expandFuzzyTokenGroups,
  expandSearchTokens,
  generateFuzzyVariants,
  normalizeSearchQuery,
  sanitizeText,
} from "./sanitize";

describe("sanitize", () => {
  it("escapes HTML entities", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("trims and limits text length", () => {
    expect(sanitizeText("  hello  ", 3)).toBe("hel");
  });

  it("normalizes search queries", () => {
    expect(normalizeSearchQuery("  Samsung   S24!  ")).toBe("samsung s24");
  });

  it("expands search tokens for typo-tolerant matching", () => {
    expect(expandSearchTokens("Samsung Galaxy")).toEqual(["samsung", "galaxy"]);
    expect(expandSearchTokens("a")).toEqual([]);
  });

  it("exports fuzzy search helpers", () => {
    const variants = generateFuzzyVariants("iphone");
    expect(variants.length).toBeGreaterThan(1);
    expect(expandFuzzyTokenGroups("iphone")).toHaveLength(1);
  });
});
