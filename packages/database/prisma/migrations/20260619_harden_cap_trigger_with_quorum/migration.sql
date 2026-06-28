-- Harden the price-cap trigger: enforce quorum at DB level + recompute cap independently.
-- This makes the invariant self-sufficient: no LIVE listing can exist with:
--   (1) fewer than 2 independent sources, or
--   (2) sellerPrice > FLOOR(0.5 * verifiedRetail)
-- The trigger now recomputes the cap internally instead of trusting the app.

CREATE OR REPLACE FUNCTION check_listing_price_cap()
RETURNS TRIGGER AS $$
DECLARE
    latest_run RECORD;
    ttl_days INTEGER;
    ref_observed_at TIMESTAMP;
    computed_cap INTEGER;
    verified_retail INTEGER;
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

        -- QUORUM CHECK: enforce >= 2 independent sources at the DB layer
        IF (latest_run."sourceCount" IS NULL) OR (latest_run."sourceCount" < 2) THEN
            RAISE EXCEPTION 'Cannot publish listing %: Quorum not met (only % sources). Minimum 2 independent sources required.',
                NEW.id, COALESCE(latest_run."sourceCount", 0);
        END IF;

        -- INDEPENDENT CAP RECOMPUTATION: do not trust the app's computedCapIqd
        -- Recalculate: cap = FLOOR(0.5 * verifiedRetailIqd)
        verified_retail := latest_run."verifiedRetailIqd";
        IF verified_retail IS NULL OR verified_retail <= 0 THEN
            RAISE EXCEPTION 'Cannot publish listing %: No verified retail price found', NEW.id;
        END IF;
        computed_cap := FLOOR(verified_retail::FLOAT * 0.5);

        -- Check if the seller price exceeds the independently-computed cap
        IF NEW."sellerPriceIqd" > computed_cap THEN
            RAISE EXCEPTION 'Cannot publish listing %: sellerPriceIqd (%) exceeds recomputed cap (%) from verified retail %',
                NEW.id, NEW."sellerPriceIqd", computed_cap, verified_retail;
        END IF;

        -- FRESHNESS CHECK: selected reference must be within category.retailTtlDays
        SELECT "retailTtlDays" INTO ttl_days
        FROM categories
        WHERE id = NEW."categoryId";

        IF FOUND THEN
            SELECT "observedAt" INTO ref_observed_at
            FROM retail_references
            WHERE id = latest_run."selectedReferenceId";

            IF FOUND THEN
                IF ref_observed_at < NOW() - (ttl_days * INTERVAL '1 day') THEN
                    RAISE EXCEPTION 'Cannot publish listing %: Selected retail reference is stale (older than % days)', NEW.id, ttl_days;
                END IF;
            ELSE
                RAISE EXCEPTION 'Cannot publish listing %: Selected retail reference not found', NEW.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END $$
LANGUAGE plpgsql;
