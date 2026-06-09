import { describe, expect, it } from "vitest";
import {
  expandFuzzyTokenGroups,
  generateFuzzyVariants,
  levenshteinDistance,
  queryMatchesText,
  tokenMatchesText,
} from "./search";

describe("search fuzzy matching", () => {
  it("computes levenshtein distance", () => {
    expect(levenshteinDistance("samsung", "samsun")).toBe(1);
    expect(levenshteinDistance("iphone", "iphne")).toBe(1);
    expect(levenshteinDistance("galaxy", "galaxy")).toBe(0);
  });

  it("generates typo variants for tokens", () => {
    const variants = generateFuzzyVariants("samsung");
    expect(variants).toContain("samsung");
    expect(variants.some((v) => v !== "samsung")).toBe(true);
  });

  it("expands fuzzy token groups from query", () => {
    const groups = expandFuzzyTokenGroups("Samsung Galaxy");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toContain("samsung");
  });

  it("matches text with single-character typos", () => {
    expect(tokenMatchesText("samsun", "Samsung Galaxy S24")).toBe(true);
    expect(tokenMatchesText("iphne", "Apple iPhone 15 Pro")).toBe(true);
    expect(tokenMatchesText("playstation", "Sony PS5 Console")).toBe(false);
  });

  it("matches full query with fuzzy tolerance", () => {
    expect(queryMatchesText("Samsun Galxy", "Samsung Galaxy S24 Ultra")).toBe(true);
    expect(queryMatchesText("Macbok", "Apple MacBook Pro M3")).toBe(true);
  });
});
