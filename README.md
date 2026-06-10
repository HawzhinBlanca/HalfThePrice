# HalfThePrice

Verified half-price marketplace for Iraq. Every live listing must be priced at or below **50% of verified retail** from trusted local sources.

## Stack

| Layer | Technology |
|-------|------------|
| Web | Next.js 15, React 19, Tailwind CSS 4 |
| Mobile | Expo Router (`apps/mobile`) |
| Database | PostgreSQL 16 + Prisma |
| Search | Meilisearch (Prisma fuzzy fallback) |
| Storage | MinIO / S3-compatible KYC docs (local fallback) |
| Chat | Centrifugo + JWT channel auth |
| Payments | Sandbox COD, ZainCash, QiCard, FastPay |
| Retail refs | `@htp/retail-crawler` (Elryan sandbox + stubs) |
| Observability | Sentry (env-gated), `/api/health` |
| CI | GitHub Actions |

## Full stack (local)

```bash
# 1. Install
pnpm install

# 2. Start all Docker services (postgres, minio, meilisearch, centrifugo)
pnpm docker:up

# 3. Environment
cp .env.example .env
cp .env.example apps/web/.env.local

# 4. Database
pnpm db:push
pnpm db:seed

# 5. Index listings in Meilisearch (optional, falls back to Prisma search)
pnpm search:sync

# 6. Web dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Docker services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5433 | Primary database |
| MinIO | 9000 (API), 9001 (console) | KYC document storage |
| Meilisearch | 7700 | Listing search + facets |
| Centrifugo | 8000 | Realtime chat |

### Mobile app

```bash
# Point at local API (use your machine IP for physical devices)
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm mobile
```

Screens: browse, listing detail, login, seller listings (read-only MVP).

### Production Docker

```bash
cp .env.example .env.prod
# Set POSTGRES_PASSWORD, NEXTAUTH_SECRET, CRON_SECRET, etc.
pnpm docker:prod
```

See `deploy/DEPLOY.md` and `fly.toml` for Fly.io deployment.

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@half-the-price.iq | password123 |
| Seller (KYC ✓) | seller@half-the-price.iq | password123 |
| Pending seller | pending-seller@half-the-price.iq | password123 |
| Buyer | buyer@half-the-price.iq | password123 |

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | JWT + CSRF signing secret |
| `NEXTAUTH_URL` | App URL |
| `CRON_SECRET` | Bearer token for stale-listing cron |
| `KYC_UPLOAD_DIR` | Local KYC fallback path |
| `MINIO_ENDPOINT` | MinIO/S3 endpoint |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `MINIO_BUCKET` | KYC bucket (default: `htp-kyc`) |
| `MEILISEARCH_HOST` | Meilisearch URL |
| `MEILISEARCH_API_KEY` | Meilisearch master key |
| `CENTRIFUGO_API_URL` | Centrifugo HTTP API |
| `CENTRIFUGO_TOKEN_SECRET` | JWT HMAC secret for channels |
| `CENTRIFUGO_API_KEY` | Centrifugo API key |
| `NEXT_PUBLIC_CENTRIFUGO_WS_URL` | WebSocket URL for chat |
| `PAYMENT_WEBHOOK_SECRET` | HMAC secret for payment webhooks |
| `SENTRY_DSN` | Sentry DSN (optional in dev) |
| `CSRF_DISABLED` | Set `true` for e2e/tests only |
| `RETAIL_CRAWLER_MODE` | `sandbox` (mock) or `live` (Elryan HTTP adapter) |
| `EXPO_PUBLIC_API_URL` | Mobile API base URL |

## API highlights

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | DB, Meilisearch, MinIO health |
| `GET /api/csrf` | CSRF token for mutating requests |
| `POST /api/cron/stale-listings` | TTL stale listing processor |
| `POST /api/retail/refresh` | Refresh retail references (crawler) |
| `POST /api/orders` | Checkout after accepted offer |
| `POST /api/payments/webhook/[provider]` | Payment webhooks (signature verified) |
| `POST /api/chat/conversations` | Start listing conversation |

## Stale listing cron

```bash
curl -X POST http://localhost:3000/api/cron/stale-listings \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Architecture

```
apps/web/                 Next.js storefront + API
apps/mobile/              Expo Router mobile MVP
packages/contracts/       Shared types + price cap logic
packages/database/        Prisma, verification engine, retail refresh
packages/search/          Meilisearch client + sync script
packages/storage/         MinIO KYC uploads
packages/payments/        Sandbox payment providers
packages/retail-crawler/  Elryan live/sandbox + stub adapters
packages/sdk/             Shared API client
```

## Medusa

Evaluated in `docs/MEDUSA_EVALUATION.md` — **not required** for MVP; orders/offers implemented in Prisma.

## Testing

```bash
pnpm lint
pnpm test
pnpm test:integration   # needs seeded DB
pnpm build
pnpm test:e2e           # Playwright (CSRF_DISABLED in webServer)
```

## Roadmap status

All tracks A–J implemented or documented. See deliverable checklist in PR/commit notes.
