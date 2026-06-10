export type RetailCrawlerMode = "sandbox" | "live";

export function getRetailCrawlerMode(): RetailCrawlerMode {
  const raw = process.env.RETAIL_CRAWLER_MODE?.toLowerCase();
  return raw === "live" ? "live" : "sandbox";
}
