import type { RetailCrawlerMode } from "../config";
import { getRetailCrawlerMode } from "../config";
import { throttle } from "../rate-limit";
import type { RetailAdapter, RetailObservation } from "../types";

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
          "[AlhafidhAdapter] live crawl failed, using sandbox fallback:",
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
    await throttle("alhafidh", 2000);

    const searchUrl = `https://api.alhafidh.com/v1/search?q=${encodeURIComponent(title)}`;
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "HalfThePriceCrawler/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Alhafidh search returned status ${response.status}`);
    }

    const payload = (await response.json()) as {
      products?: Array<{
        name: string;
        price: number;
        url: string;
        in_stock: boolean;
      }>;
    };

    if (!payload.products || payload.products.length === 0) {
      throw new Error("Alhafidh search returned no matching products");
    }

    return payload.products.map((p) => ({
      sourceName: this.sourceName,
      sourceUrl: p.url,
      observedPriceIqd: p.price,
      stockState: p.in_stock ? "IN_STOCK" : "OUT_OF_STOCK",
      productTitle: p.name,
      parserVersion: "live-1.0.0",
    }));
  }
}
