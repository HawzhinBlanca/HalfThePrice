# System Architecture & Verification Flow

## Monorepo Layout
The project is built as a lean pnpm monorepo:

* **`apps/web`:** Next.js storefront and admin portal.
* **`packages/core`:** Core services and transaction managers (orders, verification).
* **`packages/database`:** Prisma client, Postgres triggers, and advisory locks.
* **`packages/retail-crawler`:** Robots-compliant site crawlers (Elryan, Alhafidh, Miswag).
* **`packages/payments`:** Idempotency-safe payment adapters (ZainCash, QiCard, FastPay).
* **`packages/contracts`:** Shared types, constants, and price cap check rules.

## Verification Transaction Sequence
To prevent long-held locks, crawler network calls run outside of the transaction boundaries.

```mermaid
sequenceDiagram
    participant Web as Web API Route
    participant Core as Core Service (listing.ts)
    participant Crawler as Retail Crawler
    participant DB as Postgres Database

    Web->>Core: submitListingForVerification(id, sellerId)
    activate Core

    Core->>DB: Find listing & Jaro-Winkler match (Read)
    DB-->>Core: Initial Listing & Canonical Product

    alt No fresh retail references in stock
        Core->>Crawler: fetchRetailReferences(title)
        activate Crawler
        Crawler-->>Core: observations[] (observations fetched outside tx)
        deactivate Crawler
        Core->>DB: Insert new observations (Prisma client)
    end

    Core->>DB: Start $transaction & Acquire Advisory Lock
    activate DB
    DB-->>Core: Lock acquired

    Core->>DB: Re-read listing & canonical product inside lock
    DB-->>Core: Locked Listing Data

    Core->>Core: runVerification() (computes cap & checks quorum)

    Core->>DB: Update listing status (LIVE or MANUAL_REVIEW)
    Core->>DB: Create PriceVerificationRun row
    Core->>DB: Create AuditEvent row
    
    DB-->>Core: Commit Transaction
    deactivate DB

    Core-->>Web: { success: true, status, message }
    deactivate Core
```
*Note: If the listing is set to `LIVE`, the Postgres database trigger `trg_check_listing_price_cap` runs on COMMIT to verify that the price is within the computed cap and that the selected observation has not expired.*
