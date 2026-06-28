# Non-Negotiable Business & Database Rules

The following core business and database rules are hard-coded into the application's runtime services and PostgreSQL triggers to ensure complete system integrity.

## 1. The Half-Price Guarantee
* **The Rule:** A listing may exist as a draft without verification, but it cannot be published to `LIVE` unless its price satisfies:
  $$\text{sellerPriceIqd} \le \lfloor 0.50 \times \text{verifiedRetailIqd} \rfloor$$
* **Database Trigger Guard:** The `trg_check_listing_price_cap` trigger on the `listings` table intercepts all inserts/updates. It fetches the latest passing verification run, recomputes the cap ratio, and rejects changes exceeding it.

## 2. Multi-Source Quorum
* **The Rule:** Listing verification requires a minimum of **2 independent, trusted retail sources** (e.g. Elryan, Alhafidh, Miswag) in stock to automatically verify (`PASS`).
* **Fallback:** If only 1 source is available, or if the sources are unverified user submissions, the listing is routed to `MANUAL_REVIEW`.
* **Database Trigger Guard:** The `trg_check_price_verification_run_integrity` trigger on `price_verification_runs` rejects any `PASS` run that registers a `sourceCount` < 2.

## 3. Freshness & Stale Expiry (TTL)
* **The Rule:** Retail price observations must be fresh. If the selected observation ages past the category's `retailTtlDays` (default 30 days), the listing becomes `STALE` and is hidden from public browse.
* **Database Trigger Guard:** The listings trigger prevents setting a listing to `LIVE` if its selected retail reference's `observedAt` is older than `retailTtlDays`.

## 4. Anomaly and Outlier Guard
* **The Rule:** Outlier prices from crawler sources are filtered out using Median and interquartile range (IQR) checks.
* **Ad-Hoc Anomaly Guard:** Individual observations whose price deviates by more than 30% from the median of all fresh observations are discarded before picking the closest match.

## 5. Double-Offer and Order Idempotency
* **Double-Offer Guard:** A buyer is limited to exactly one `PENDING` or `ACCEPTED` offer per listing. Concurrent offers return a `409 Conflict`.
* **Idempotency Keys:** Mutating payment transitions require an `x-idempotency-key` header to ensure exactly-once charge verification and order creation.

## 6. Dynamic Operations Kill-Switches
* **The Rule:** Runtime features (e.g. `CHAT`, `ONBOARDING`, `CRAWLER_LIVE`) can be disabled globally via the `FeatureFlags` table without redeploying. Disabled flags return clean validation errors (`503 Service Unavailable` or mock sandbox states).
