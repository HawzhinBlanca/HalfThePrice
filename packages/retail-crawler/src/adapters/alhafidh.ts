import type { RetailAdapter, RetailObservation } from "../types";

/** Alhafidh adapter stub — appliance categories pending Crawl4AI integration. */
export class AlhafidhAdapter implements RetailAdapter {
  readonly sourceName = "Alhafidh";
  readonly parserVersion = "stub-0.1.0";

  async searchByTitle(_title: string): Promise<RetailObservation[]> {
    return [];
  }
}
