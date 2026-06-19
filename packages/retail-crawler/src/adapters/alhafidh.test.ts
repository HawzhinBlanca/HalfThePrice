import { afterEach, describe, expect, it, vi } from "vitest";
import { AlhafidhAdapter } from "./alhafidh";
import { parseAlhafidhSearchResponse } from "./alhafidh-parse";
import { clearRobotsCacheForTests } from "../robots";

describe("Alhafidh sandbox adapter", () => {
  it("returns matching Samsung observations", async () => {
    const results = await new AlhafidhAdapter("sandbox").searchByTitle(
      "Samsung Galaxy A54 128GB",
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.sourceName).toBe("Alhafidh");
    expect(results[0]?.observedPriceIqd).toBeGreaterThan(0);
    expect(results[0]?.parserVersion).toContain("sandbox");
  });
});

describe("Alhafidh live parser", () => {
  it("parses suggest search products", () => {
    const observations = parseAlhafidhSearchResponse(
      {
        resources: {
          results: {
            products: [
              {
                available: true,
                price: "450000.000",
                title: "Galaxy A54 5G 128GB",
                vendor: "Samsung",
                url: "/en/products/samsung-galaxy-a54-5g",
                handle: "samsung-galaxy-a54-5g",
                id: 12345,
              },
              {
                available: false,
                price: "15000.000",
                title: "Galaxy A54 Glass Protector",
                vendor: "Samsung",
                url: "/en/products/samsung-galaxy-a54-glass-protector",
                handle: "samsung-galaxy-a54-glass-protector",
                id: 67890,
              },
            ],
          },
        },
      },
      "Samsung Galaxy A54 128GB",
    );

    expect(observations.length).toBeGreaterThanOrEqual(1);
    expect(observations[0]?.observedPriceIqd).toBe(450000);
    expect(observations[0]?.sourceUrl).toContain("samsung-galaxy-a54-5g");
    expect(observations[0]?.stockState).toBe("IN_STOCK");
    expect(observations[0]?.parserVersion).toBe("live-1.0.0");
  });
});

describe("Alhafidh live adapter (mocked HTTP)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearRobotsCacheForTests();
    vi.unstubAllEnvs();
  });

  it("fetches live catalog results when mode is live", async () => {
    vi.stubEnv("RETAIL_CRAWLER_MODE", "live");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return new Response("", { status: 200 });
      }
      return new Response(
        JSON.stringify({
          resources: {
            results: {
              products: [
                {
                  available: true,
                  price: "452880.000",
                  title: "Galaxy A54 5G 128GB",
                  vendor: "Samsung",
                  url: "/en/products/samsung-galaxy-a54-5g",
                  handle: "samsung-galaxy-a54-5g",
                  id: 12345,
                },
              ],
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await new AlhafidhAdapter("live").searchByTitle(
      "Samsung Galaxy A54",
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.parserVersion).toBe("live-1.0.0");
    expect(results[0]?.observedPriceIqd).toBe(452880);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("does NOT fall back to sandbox in live mode on failure by default", async () => {
    vi.stubEnv("RETAIL_CRAWLER_MODE", "live");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network blocked");
      }),
    );

    const results = await new AlhafidhAdapter("live").searchByTitle(
      "Samsung Galaxy A54 128GB",
    );

    expect(results).toHaveLength(0);
  });

  it("falls back to sandbox in live mode on failure when ALLOW_SANDBOX_FALLBACK is true", async () => {
    vi.stubEnv("RETAIL_CRAWLER_MODE", "live");
    vi.stubEnv("ALLOW_SANDBOX_FALLBACK", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network blocked");
      }),
    );

    const results = await new AlhafidhAdapter("live").searchByTitle(
      "Samsung Galaxy A54 128GB",
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.parserVersion).toBe("sandbox-1.0.0");
  });
});
