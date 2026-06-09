# HalfThePrice deployment

## Docker Compose (production)

```bash
cp .env.example .env.prod
# Fill POSTGRES_PASSWORD, NEXTAUTH_SECRET, CRON_SECRET, MINIO_*, MEILISEARCH_API_KEY, CENTRIFUGO_*

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## Fly.io

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/)
2. `fly launch --no-deploy` (or use existing `fly.toml`)
3. Set secrets:

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  NEXTAUTH_SECRET="..." \
  NEXTAUTH_URL="https://half-the-price.fly.dev" \
  CRON_SECRET="..." \
  MINIO_ENDPOINT="..." \
  MINIO_ACCESS_KEY="..." \
  MINIO_SECRET_KEY="..." \
  MEILISEARCH_API_KEY="..." \
  CENTRIFUGO_TOKEN_SECRET="..." \
  PAYMENT_WEBHOOK_SECRET="..."
```

4. `fly deploy`

Provision Postgres (Fly Postgres or external), MinIO, Meilisearch, and Centrifugo as separate Fly apps or use managed equivalents.

## Stale listing cron

Schedule a POST to `/api/cron/stale-listings` with header `Authorization: Bearer $CRON_SECRET`.

Example (cron job / GitHub Action / Fly Machines):

```bash
curl -X POST "$NEXTAUTH_URL/api/cron/stale-listings" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Health checks

- `GET /api/health` — returns DB, Meilisearch, and MinIO connectivity status.
