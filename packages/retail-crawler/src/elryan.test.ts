import { describe, expect, it } from "vitest";
import { ElryanAdapter, fetchRetailReferences } from "./index";

describe("Elryan sandbox adapter", () => {
  it("returns matching Samsung observations", async () => {
    const results = await new ElryanAdapter().searchByTitle(
      "Samsung Galaxy A54 128GB",
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.sourceName).toBe("Elryan");
    expect(results[0]?.observedPriceIqd).toBeGreaterThan(0);
    expect(results[0]?.parserVersion).toContain("sandbox");
  });

  it("aggregates across adapters", async () => {
    const results = await fetchRetailReferences("iPhone 13");
    expect(results.some((r) => r.sourceName === "Elryan")).toBe(true);
  });
});
