import type { RetailAdapter, RetailObservation } from "../types";

/** Miswag adapter stub — returns empty until Crawl4AI onboarding completes. */
export class MiswagAdapter implements RetailAdapter {
  readonly sourceName = "Miswag";
  readonly parserVersion = "stub-0.1.0";

  async searchByTitle(_title: string): Promise<RetailObservation[]> {
    return [];
  }
}
