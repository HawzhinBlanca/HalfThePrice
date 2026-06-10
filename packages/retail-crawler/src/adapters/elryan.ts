import type { RetailCrawlerMode } from "../config";
import { getRetailCrawlerMode } from "../config";
import { throttle } from "../rate-limit";
import { getCrawlerUserAgent, isPathAllowed } from "../robots";
import type { RetailAdapter, RetailObservation } from "../types";
import {
  ELRYAN_ORIGIN,
  ELRYAN_SEARCH_PATH,
  parseElryanSearchResponse,
  type ElryanSearchResponse,
} from "./elryan-parse";

const MOCK_CATALOG: Array<{
  keywords: string[];
  title: string;
  priceIqd: number;
  url: string;
}> = [
  {
    keywords: ["samsung", "galaxy", "a54"],
    title: "Samsung Galaxy A54 5G 128GB",
    priceIqd: 485_000,
    url: "https://www.elryan.com/samsung-galaxy-a54-5g-128gb",
  },
  {
    keywords: ["iphone", "13"],
    title: "Apple iPhone 13 128GB",
    priceIqd: 890_000,
    url: "https://www.elryan.com/apple-iphone-13-128gb",
  },
  {
    keywords: ["lenovo", "ideapad"],
    title: "Lenovo IdeaPad Slim 3 15",
    priceIqd: 625_000,
    url: "https://www.elryan.com/lenovo-ideapad-slim-3-15",
  },
  {
    keywords: ["lg", "refrigerator", "fridge"],
    title: "LG GN-B472PQMB Refrigerator",
    priceIqd: 1_150_000,
    url: "https://www.elryan.com/lg-gn-b472pqmb",
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function scoreMatch(query: string, keywords: string[]): number {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const hits = keywords.filter((kw) =>
    tokens.some((t) => kw.includes(t) || t.includes(kw)),
  ).length;
  return hits / keywords.length;
}

export class ElryanAdapter implements RetailAdapter {
  readonly sourceName = "Elryan";

  constructor(private readonly modeOverride?: RetailCrawlerMode) {}

  get parserVersion(): string {
    const mode = this.modeOverride ?? getRetailCrawlerMode();
    return mode === "live" ? "live-1.0.0" : "sandbox-1.0.0";
  }

  async searchByTitle(title: string): Promise<RetailObservation[]> {
    const mode = this.modeOverride ?? getRetailCrawlerMode();
    if (mode === "live") {
      try {
        return await this.searchLive(title);
      } catch (error) {
        console.warn(
          "[ElryanAdapter] live crawl failed, using sandbox fallback:",
          error instanceof Error ? error.message : error,
        );
        return this.searchSandbox(title);
      }
    }
    return this.searchSandbox(title);
  }

  private searchSandbox(title: string): RetailObservation[] {
    const ranked = MOCK_CATALOG.map((item) => ({
      item,
      score: scoreMatch(title, item.keywords),
    }))
      .filter((r) => r.score >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return ranked.map(({ item }) => ({
      sourceName: this.sourceName,
      sourceUrl: item.url,
      observedPriceIqd: item.priceIqd,
      stockState: "IN_STOCK",
      productTitle: item.title,
      parserVersion: "sandbox-1.0.0",
    }));
  }

  private async searchLive(title: string): Promise<RetailObservation[]> {
    const allowed = await isPathAllowed(ELRYAN_ORIGIN, "/api/catalog/");
    if (!allowed) {
      throw new Error("Elryan robots.txt disallows catalog API path");
    }

    await throttle("elryan", 2000);

    const body = {
      query: {
        bool: {
          must: [{ match: { name: title } }],
          filter: [{ range: { iqd_price: { gt: 0 } } }],
        },
      },
      size: 8,
      _source: [
        "name",
        "url_path",
        "iqd_price",
        "final_price",
        "price",
        "stock.is_in_stock",
      ],
    };

    const response = await fetch(`${ELRYAN_ORIGIN}${ELRYAN_SEARCH_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": getCrawlerUserAgent(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      throw new Error(
        `Elryan catalog API returned ${response.status} ${response.statusText}`,
      );
    }

    const payload = (await response.json()) as ElryanSearchResponse;
    const observations = parseElryanSearchResponse(payload, title);
    if (observations.length === 0) {
      throw new Error("Elryan catalog API returned no matching priced products");
    }
    return observations;
  }
}
