-- AlterTable
ALTER TABLE "price_verification_runs" ADD COLUMN "sourceCount" INTEGER DEFAULT 0;

-- Create Trigger for price_verification_runs integrity
CREATE OR REPLACE FUNCTION check_price_verification_run_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.result = 'PASS' THEN
        -- Enforce quorum: sourceCount must be >= 2
        IF NEW."sourceCount" IS NULL OR NEW."sourceCount" < 2 THEN
            RAISE EXCEPTION 'Cannot save PASS verification run: sourceCount (%) must be at least 2', NEW."sourceCount";
        END IF;

        -- verifiedRetailIqd must not be null
        IF NEW."verifiedRetailIqd" IS NULL THEN
            RAISE EXCEPTION 'Cannot save PASS verification run: verifiedRetailIqd must not be null';
        END IF;

        -- Recompute and verify the cap: floor(priceCapRatio * verifiedRetailIqd)
        IF NEW."computedCapIqd" IS NULL OR NEW."computedCapIqd" != FLOOR(COALESCE(NEW."priceCapRatio", 0.5) * NEW."verifiedRetailIqd") THEN
            RAISE EXCEPTION 'Cannot save PASS verification run: computedCapIqd (%) does not match recomputed cap (%)',
                NEW."computedCapIqd", FLOOR(COALESCE(NEW."priceCapRatio", 0.5) * NEW."verifiedRetailIqd");
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_price_verification_run_integrity ON price_verification_runs;

CREATE TRIGGER trg_check_price_verification_run_integrity
BEFORE INSERT OR UPDATE ON price_verification_runs
FOR EACH ROW
EXECUTE FUNCTION check_price_verification_run_integrity();

-- Re-create listings trigger to recompute cap instead of trusting computedCapIqd
CREATE OR REPLACE FUNCTION check_listing_price_cap()
RETURNS TRIGGER AS $$
DECLARE
    latest_run RECORD;
    ttl_days INTEGER;
    ref_observed_at TIMESTAMP;
    recomputed_cap INTEGER;
BEGIN
    -- Only check if status is set to 'LIVE'
    IF NEW.status = 'LIVE' THEN
        -- Find the latest price verification run for this listing that passed
        SELECT * INTO latest_run
        FROM price_verification_runs
        WHERE "listingId" = NEW.id
          AND result = 'PASS'
        ORDER BY "createdAt" DESC
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cannot publish listing %: No passing verification run found', NEW.id;
        END IF;

        -- Recompute floor(priceCapRatio * verifiedRetailIqd)
        recomputed_cap := FLOOR(COALESCE(latest_run."priceCapRatio", 0.5) * latest_run."verifiedRetailIqd");

        -- Check if the seller price exceeds the recomputed cap
        IF NEW."sellerPriceIqd" > recomputed_cap THEN
            RAISE EXCEPTION 'Cannot publish listing %: sellerPriceIqd (%) exceeds recomputed cap (%)',
                NEW.id, NEW."sellerPriceIqd", recomputed_cap;
        END IF;

        -- Check if the selected reference is fresher than category.retailTtlDays
        SELECT "retailTtlDays" INTO ttl_days
        FROM categories
        WHERE id = NEW."categoryId";

        IF FOUND THEN
            SELECT "observedAt" INTO ref_observed_at
            FROM retail_references
            WHERE id = latest_run."selectedReferenceId";

            IF FOUND THEN
                IF ref_observed_at < NOW() - (ttl_days * INTERVAL '1 day') THEN
                    RAISE EXCEPTION 'Cannot publish listing %: Selected retail reference is stale', NEW.id;
                END IF;
            ELSE
                RAISE EXCEPTION 'Cannot publish listing %: Selected retail reference not found', NEW.id;
            END IF;
        ELSE
            RAISE EXCEPTION 'Cannot publish listing %: Category not found', NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_listing_price_cap ON listings;

CREATE TRIGGER trg_check_listing_price_cap
BEFORE INSERT OR UPDATE ON listings
FOR EACH ROW
EXECUTE FUNCTION check_listing_price_cap();
