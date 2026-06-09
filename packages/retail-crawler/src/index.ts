import { AlhafidhAdapter } from "./adapters/alhafidh";
import { ElryanAdapter } from "./adapters/elryan";
import { MiswagAdapter } from "./adapters/miswag";
import type { RetailAdapter, RetailObservation } from "./types";

export * from "./types";
export { ElryanAdapter } from "./adapters/elryan";
export { MiswagAdapter } from "./adapters/miswag";
export { AlhafidhAdapter } from "./adapters/alhafidh";

const adapters: RetailAdapter[] = [
  new ElryanAdapter(),
  new MiswagAdapter(),
  new AlhafidhAdapter(),
];

export function getRetailAdapters(): RetailAdapter[] {
  return adapters;
}

export async function fetchRetailReferences(
  productTitle: string,
): Promise<RetailObservation[]> {
  const results = await Promise.all(
    adapters.map((adapter) => adapter.searchByTitle(productTitle)),
  );
  return results.flat();
}
