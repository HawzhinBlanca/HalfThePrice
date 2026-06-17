import { afterEach, describe, expect, it, vi } from "vitest";
import { ElryanAdapter, fetchRetailReferences } from "./index";
import {
  parseElryanSearchResponse,
  resolveElryanPriceDetails,
} from "./adapters/elryan-parse";
import { clearRobotsCacheForTests } from "./robots";

describe("Elryan sandbox adapter", () => {
  it("returns matching Samsung observations", async () => {
    const results = await new ElryanAdapter("sandbox").searchByTitle(
      "Samsung Galaxy A54 128GB",
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.sourceName).toBe("Elryan");
    expect(results[0]?.observedPriceIqd).toBeGreaterThan(0);
    expect(results[0]?.parserVersion).toContain("sandbox");
  });

  it("aggregates across adapters in sandbox mode", async () => {
    vi.stubEnv("RETAIL_CRAWLER_MODE", "sandbox");
    const results = await fetchRetailReferences("iPhone 13");
    expect(results.some((r) => r.sourceName === "Elryan")).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("Elryan live parser", () => {
  it("prefers iqd_price over USD conversion", () => {
    const details = resolveElryanPriceDetails({
      iqd_price: 452_880,
      final_price: 294,
    });
    expect(details.observedPriceIqd).toBe(452_880);
    expect(details.nativeCurrency).toBe("IQD");
  });

  it("converts USD when iqd_price missing", () => {
    const details = resolveElryanPriceDetails({ final_price: 100 });
    expect(details.observedPriceIqd).toBe(154_000);
    expect(details.nativeCurrency).toBe("USD");
    expect(details.exchangeRate).toBe(1540);
  });

  it("parses catalog search hits", () => {
    const observations = parseElryanSearchResponse(
      {
        hits: {
          hits: [
            {
              _source: {
                name: "Samsung Galaxy A54 5G Dual SIM 256GB",
                url_path: "samsung-galaxy-a54-5g.html",
                iqd_price: 452_880,
                stock: { is_in_stock: true },
              },
            },
            {
              _source: {
                name: "Screen protector for Samsung Galaxy A55",
                url_path: "protector-a55.html",
                iqd_price: 15_000,
                stock: { is_in_stock: true },
              },
            },
          ],
        },
      },
      "Samsung Galaxy A54 128GB",
    );

    expect(observations.length).toBeGreaterThanOrEqual(1);
    expect(observations[0]?.observedPriceIqd).toBe(452_880);
    expect(observations[0]?.sourceUrl).toContain("samsung-galaxy-a54");
    expect(observations[0]?.stockState).toBe("IN_STOCK");
    expect(observations[0]?.parserVersion).toBe("live-1.0.0");
  });
});

describe("Elryan live adapter (mocked HTTP)", () => {
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
          hits: {
            hits: [
              {
                _source: {
                  name: "Samsung Galaxy A54 5G Dual SIM 256GB",
                  url_path: "samsung-galaxy-a54-5g.html",
                  iqd_price: 452_880,
                  stock: { is_in_stock: false },
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await new ElryanAdapter("live").searchByTitle(
      "Samsung Galaxy A54",
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.parserVersion).toBe("live-1.0.0");
    expect(results[0]?.observedPriceIqd).toBe(452_880);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("falls back to sandbox when live API fails", async () => {
    vi.stubEnv("RETAIL_CRAWLER_MODE", "live");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network blocked");
      }),
    );

    const results = await new ElryanAdapter("live").searchByTitle(
      "Samsung Galaxy A54 128GB",
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.parserVersion).toBe("sandbox-1.0.0");
  });
});
