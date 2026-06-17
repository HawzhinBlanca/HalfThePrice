# Salvaged TRUSTED_SOURCES Logic

The following logic was found in the recursive copy of `packages/database/packages/database/src/verification.ts`. Since that directory will be deleted as part of Phase 0, we have salvaged this code to be integrated during Phase 1 (quorum on retail sources and trust boundaries).

## Code Snippet

```typescript
/**
 * Define trusted sources for retail references.
 * These are the sources from which we consider retail price data valid.
 */
export const TRUSTED_SOURCES = new Set([
  "official-retailer",
  "authorized-dealer",
  "brand-website",
  "verified-marketplace",
]);

// ...

export function selectVerifiedRetailPrice(
  references: VerificationInput["retailReferences"],
  ttlDays: number,
): { price: number; referenceId: string } | null {
  const freshInStock = references.filter((ref) => 
    ref.stockState === "IN_STOCK" && 
    isReferenceFresh(ref.observedAt, ttlDays) && 
    TRUSTED_SOURCES.has(ref.sourceName)
  );
  if (freshInStock.length === 0) return null;
  const prices = filterOutliers(freshInStock.map((r) => r.observedPriceIqd));
  if (prices.length === 0) return null;
  const medianPrice = median(prices);
  const closest = freshInStock.reduce((best, ref) => {
    const diff = Math.abs(ref.observedPriceIqd - medianPrice);
    const bestDiff = Math.abs(best.observedPriceIqd - medianPrice);
    return diff < bestDiff ? ref : best;
  });
  return { price: medianPrice, referenceId: closest.id };
}
```
