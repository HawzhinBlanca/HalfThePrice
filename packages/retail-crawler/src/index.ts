import { AlhafidhAdapter } from "./adapters/alhafidh";
import { ElryanAdapter } from "./adapters/elryan";
import { MiswagAdapter } from "./adapters/miswag";
import { getRetailCrawlerMode } from "./config";
import type { RetailAdapter, RetailObservation } from "./types";

export * from "./types";
export * from "./config";
export { ElryanAdapter } from "./adapters/elryan";
export { MiswagAdapter } from "./adapters/miswag";
export { AlhafidhAdapter } from "./adapters/alhafidh";
export {
  parseElryanSearchResponse,
  resolveElryanPriceDetails,
  ELRYAN_ORIGIN,
  ELRYAN_SEARCH_PATH,
} from "./adapters/elryan-parse";
export {
  parseAlhafidhSearchResponse,
  ALHAFIDH_ORIGIN,
  ALHAFIDH_SEARCH_PATH,
} from "./adapters/alhafidh-parse";

const sandboxAdapters: RetailAdapter[] = [
  new ElryanAdapter("sandbox"),
  new MiswagAdapter(),
  new AlhafidhAdapter(),
];

const liveAdapters: RetailAdapter[] = [
  new ElryanAdapter("live"),
  new MiswagAdapter(),
  new AlhafidhAdapter(),
];

export function getRetailAdapters(): RetailAdapter[] {
  return getRetailCrawlerMode() === "live" ? liveAdapters : sandboxAdapters;
}

export async function fetchRetailReferences(
  productTitle: string,
): Promise<RetailObservation[]> {
  const adapters = getRetailAdapters();
  const results = await Promise.all(
    adapters.map((adapter) => adapter.searchByTitle(productTitle)),
  );
  return results.flat();
}
