import { fetchRetailReferences } from "@htp/retail-crawler";
import { prisma } from "./client";
import { hashEvidence } from "./verification";

export interface RetailRefreshResult {
  canonicalProductId: string;
  inserted: number;
  sources: string[];
}

import { isDatabaseFeatureEnabled } from "./features";

export async function refreshRetailReferencesForTitle(
  productTitle: string,
  canonicalProductId?: string,
): Promise<RetailRefreshResult | null> {
  let productId = canonicalProductId;

  if (!productId) {
    const candidates = await prisma.canonicalProduct.findMany({
      take: 50,
    });

    const normalized = productTitle.toLowerCase();
    const match = candidates.find(
      (p) =>
          normalized.includes(p.brand.toLowerCase()) ||
          normalized.includes(p.model.toLowerCase()),
    );
    productId = match?.id;
  }

  if (!productId) return null;

  if (!(await isDatabaseFeatureEnabled("CRAWLER_LIVE"))) {
    return {
      canonicalProductId: productId,
      inserted: 0,
      sources: [],
    };
  }

  const observations = await fetchRetailReferences(productTitle);
  const now = new Date();
  let inserted = 0;

  for (const obs of observations) {
    const evidenceHash = hashEvidence(
      obs.sourceUrl,
      obs.observedPriceIqd,
      now,
    );

    const existing = await prisma.retailReference.findFirst({
      where: {
        canonicalProductId: productId,
        evidenceHash,
      },
    });

    if (existing) continue;

    await prisma.retailReference.create({
      data: {
        canonicalProductId: productId,
        sourceName: obs.sourceName,
        sourceUrl: obs.sourceUrl,
        observedPriceIqd: obs.observedPriceIqd,
        nativeCurrency: obs.nativeCurrency ?? "IQD",
        nativeAmount: obs.nativeAmount ?? obs.observedPriceIqd,
        exchangeRate: obs.exchangeRate ?? 1.0,
        rateTimestamp: obs.rateTimestamp ?? now,
        stockState: obs.stockState,
        observedAt: now,
        parserVersion: obs.parserVersion,
        evidenceHash,
      },
    });
    inserted++;
  }

  return {
    canonicalProductId: productId,
    inserted,
    sources: [...new Set(observations.map((o) => o.sourceName))],
  };
}
