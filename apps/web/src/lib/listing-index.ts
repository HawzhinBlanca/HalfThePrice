import { indexListingDocument, removeListingFromIndex } from "@htp/search";
import type { Listing, Category, CanonicalProduct } from "@htp/database";

type ListingWithRelations = Listing & {
  category: Category;
  canonicalProduct: CanonicalProduct | null;
};

export async function syncListingToSearch(
  listing: ListingWithRelations,
): Promise<void> {
  if (listing.status !== "LIVE") {
    await removeListingFromIndex(listing.id);
    return;
  }

  await indexListingDocument({
    id: listing.id,
    title: listing.title,
    description: listing.description,
    sellerPriceIqd: listing.sellerPriceIqd,
    governorate: listing.governorate,
    categoryId: listing.categoryId,
    categoryName: listing.category.nameEn,
    brand: listing.canonicalProduct?.brand ?? null,
    model: listing.canonicalProduct?.model ?? null,
    status: listing.status,
    publishedAt: listing.publishedAt?.getTime() ?? null,
  });
}
