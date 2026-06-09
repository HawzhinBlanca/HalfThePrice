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

/**
 * Elryan adapter — sandbox catalog backed by realistic Iraqi retail SKUs.
 * Production would use Crawl4AI against public product pages.
 */
export class ElryanAdapter implements RetailAdapter {
  readonly sourceName = "Elryan";
  readonly parserVersion = "sandbox-1.0.0";

  async searchByTitle(title: string): Promise<RetailObservation[]> {
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
      parserVersion: this.parserVersion,
    }));
  }
}
