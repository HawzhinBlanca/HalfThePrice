import { prisma } from "@htp/database";
import {
  createMeiliClient,
  ensureListingsIndex,
  LISTINGS_INDEX,
  type ListingSearchDocument,
} from "./index";

async function main() {
  const client = createMeiliClient();
  if (!client) {
    console.error("MEILISEARCH_HOST is not set. Aborting sync.");
    process.exit(1);
  }

  await ensureListingsIndex(client);

  const listings = await prisma.listing.findMany({
    where: { status: "LIVE" },
    include: {
      category: true,
      canonicalProduct: true,
    },
  });

  const docs: ListingSearchDocument[] = listings.map((listing) => ({
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
  }));

  if (docs.length === 0) {
    console.log("No LIVE listings to index.");
    return;
  }

  const task = await client.index(LISTINGS_INDEX).addDocuments(docs, {
    primaryKey: "id",
  });
  console.log(`Indexed ${docs.length} listings. Task UID: ${task.taskUid}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
