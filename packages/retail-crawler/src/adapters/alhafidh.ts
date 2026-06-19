import type { RetailCrawlerMode } from "../config";
import { getRetailCrawlerMode } from "../config";
import { throttle } from "../rate-limit";
import { getCrawlerUserAgent, isPathAllowed } from "../robots";
import type { RetailAdapter, RetailObservation } from "../types";
import {
  ALHAFIDH_ORIGIN,
  ALHAFIDH_SEARCH_PATH,
  parseAlhafidhSearchResponse,
  type AlhafidhSearchResponse,
} from "./alhafidh-parse";

const MOCK_CATALOG: Array<{
  keywords: string[];
  title: string;
  priceIqd: number;
  url: string;
}> = [
  {
    keywords: ["samsung", "galaxy", "a54"],
    title: "Samsung Galaxy A54 5G 128GB",
    priceIqd: 489_000,
    url: "https://www.alhafidh.com/samsung-galaxy-a54-5g-128gb",
  },
  {
    keywords: ["iphone", "13"],
    title: "Apple iPhone 13 128GB",
    priceIqd: 895_000,
    url: "https://www.alhafidh.com/apple-iphone-13-128gb",
  },
  {
    keywords: ["lenovo", "ideapad"],
    title: "Lenovo IdeaPad Slim 3 15",
    priceIqd: 629_000,
    url: "https://www.alhafidh.com/lenovo-ideapad-slim-3-15",
  },
  {
    keywords: ["lg", "refrigerator", "fridge"],
    title: "LG GN-B472PQMB Refrigerator",
    priceIqd: 1_160_000,
    url: "https://www.alhafidh.com/lg-gn-b472pqmb",
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

export class AlhafidhAdapter implements RetailAdapter {
  readonly sourceName = "Alhafidh";

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
          "[AlhafidhAdapter] live crawl failed:",
          error instanceof Error ? error.message : error,
        );
        if (process.env.ALLOW_SANDBOX_FALLBACK === "true") {
          console.warn("[AlhafidhAdapter] falling back to sandbox (allow-sandbox-fallback is true)");
          return this.searchSandbox(title);
        }
        return [];
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
      nativeCurrency: "IQD",
      nativeAmount: item.priceIqd,
      exchangeRate: 1.0,
      rateTimestamp: new Date(),
    }));
  }

  private async searchLive(title: string): Promise<RetailObservation[]> {
    const allowed = await isPathAllowed(ALHAFIDH_ORIGIN, ALHAFIDH_SEARCH_PATH);
    if (!allowed) {
      throw new Error("Alhafidh robots.txt disallows search path");
    }

    await throttle("alhafidh", 2000);

    const searchUrl = `${ALHAFIDH_ORIGIN}${ALHAFIDH_SEARCH_PATH}?q=${encodeURIComponent(title)}&resources[type]=product`;
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": getCrawlerUserAgent(),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Alhafidh search returned status ${response.status}`);
    }

    const payload = (await response.json()) as AlhafidhSearchResponse;
    const observations = parseAlhafidhSearchResponse(payload, title);
    if (observations.length === 0) {
      throw new Error("Alhafidh suggest API returned no matching products");
    }
    return observations;
  }
}
