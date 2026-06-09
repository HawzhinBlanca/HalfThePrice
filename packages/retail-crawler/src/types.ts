export interface RetailObservation {
  sourceName: string;
  sourceUrl: string;
  observedPriceIqd: number;
  stockState: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  productTitle: string;
  parserVersion: string;
}

export interface RetailAdapter {
  readonly sourceName: string;
  readonly parserVersion: string;
  searchByTitle(title: string): Promise<RetailObservation[]>;
}
