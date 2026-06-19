import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@htp/database";
import { createOrderFromOffer } from "./order";

/**
 * Money-path integration tests against a real seeded Postgres.
 *
 * These exist because the green build + unit suite never exercised the
 * order-creation transaction, the advisory lock, or the `Order.offerId @unique`
 * backstop. The properties proven here are the exactly-once guarantees that
 * protect a buyer from being double-charged / double-ordered.
 *
 * Requires: pnpm db:seed (so a LIVE listing + BUYER exist).
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("createOrderFromOffer (money path)", () => {
  let buyerId: string;
  let listingId: string;
  const createdOfferIds: string[] = [];

  beforeAll(async () => {
    const buyer = await prisma.user.findUnique({
      where: { email: "buyer@half-the-price.iq" },
    });
    const listing = await prisma.listing.findFirst({
      where: { status: "LIVE" },
    });
    if (!buyer || !listing) {
      throw new Error("Seed data required. Run `pnpm db:seed` first.");
    }
    buyerId = buyer.id;
    listingId = listing.id;
  });

  afterAll(async () => {
    // Clean up only what these tests created.
    await prisma.order.deleteMany({ where: { offerId: { in: createdOfferIds } } });
    await prisma.offer.deleteMany({ where: { id: { in: createdOfferIds } } });
    await prisma.$disconnect();
  });

  async function makeAcceptedOffer(amountIqd = 50_000): Promise<string> {
    const offer = await prisma.offer.create({
      data: {
        listingId,
        buyerId,
        amountIqd,
        capSnapshotIqd: amountIqd,
        status: "ACCEPTED",
      },
    });
    createdOfferIds.push(offer.id);
    return offer.id;
  }

  it("creates exactly one order from an accepted offer", async () => {
    const offerId = await makeAcceptedOffer(50_000);
    const { order } = await createOrderFromOffer(offerId, buyerId, "COD");

    expect(order.offerId).toBe(offerId);
    expect(order.amountIqd).toBe(50_000);

    const count = await prisma.order.count({ where: { offerId } });
    expect(count).toBe(1);
  });

  it("is idempotent: a second call returns the same order, never a second row", async () => {
    const offerId = await makeAcceptedOffer(60_000);

    const first = await createOrderFromOffer(offerId, buyerId, "COD");
    const second = await createOrderFromOffer(offerId, buyerId, "COD");

    expect(second.order.id).toBe(first.order.id);
    const count = await prisma.order.count({ where: { offerId } });
    expect(count).toBe(1);
  });

  it("survives a concurrent double-checkout race: exactly one order wins", async () => {
    const offerId = await makeAcceptedOffer(70_000);

    // Fire two checkouts for the SAME offer simultaneously. The advisory lock
    // + Order.offerId @unique must collapse them to a single order.
    const results = await Promise.allSettled([
      createOrderFromOffer(offerId, buyerId, "COD"),
      createOrderFromOffer(offerId, buyerId, "COD"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    // At least one must succeed; if both succeed they must reference one order.
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const orderIds = new Set(
      fulfilled.map((r) =>
        (r as PromiseFulfilledResult<{ order: { id: string } }>).value.order.id,
      ),
    );
    expect(orderIds.size).toBe(1);

    const count = await prisma.order.count({ where: { offerId } });
    expect(count).toBe(1);
  });

  it("rejects an offer that is not ACCEPTED", async () => {
    const offer = await prisma.offer.create({
      data: { listingId, buyerId, amountIqd: 40_000, capSnapshotIqd: 40_000, status: "PENDING" },
    });
    createdOfferIds.push(offer.id);

    await expect(createOrderFromOffer(offer.id, buyerId, "COD")).rejects.toThrow("ORDER_INVALID");
  });

  it("rejects a buyer who does not own the offer", async () => {
    const offerId = await makeAcceptedOffer(45_000);
    await expect(
      createOrderFromOffer(offerId, "not-the-buyer-id", "COD"),
    ).rejects.toThrow("OFFER_NOT_FOUND");
  });
});
