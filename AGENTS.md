# AGENTS.md — Operating rules for AI coding agents

## Project
HalfThePrice — a verified half-price marketplace for Iraq. Every live listing must be priced at
or below 50% of verified retail. pnpm monorepo: Next.js 15 + React 19 (`apps/web`), Expo
(`apps/mobile`), PostgreSQL 16 + Prisma (`packages/database`), plus contracts/core/search/
storage/payments/retail-crawler/sdk packages. Node ≥ 20, pnpm 10.12.1.

## Commands (exact)
- Install:    pnpm install --frozen-lockfile
- Typecheck:  pnpm -r typecheck
- Lint:       pnpm lint
- Test:       pnpm test                  # web + database + payments + retail-crawler (vitest)
- Integration: pnpm test:integration     # needs a seeded Postgres
- Build:      pnpm build                 # prisma generate + next build
- E2E:        pnpm test:e2e              # Playwright (CSRF_DISABLED in webServer)
- Verify ALL: bash scripts/verify.sh     # guards + typecheck + lint + test + build — run before "done"
- DB:         pnpm db:push | db:seed | db:migrate | db:generate   (Postgres via `pnpm docker:up`)

## Workflow (non-negotiable)
1. RESEARCH before coding — map the real symbols (the codebase is indexed; use search).
2. Smallest correct change. Add/adjust tests for the behavior you change. Test-first for new logic.
3. After each change run `bash scripts/verify.sh`. Only commit when it exits 0.
4. Never mark work "done" by judgment. "Done" = `verify.sh` green locally AND the required CI
   checks green on the PR. CI is the source of truth (it adds Postgres, migrate, integration,
   E2E, audit, SBOM, drift).

## Hard boundaries (do not cross)
- Never edit or commit: `.env`, `.env.*` (except `.env.example`), `**/*.pem`, `secrets/**`,
  `node_modules/**`, `.next/**`, `dist/**`, `build/**`, `backup/**`.
- Never commit secrets. Never weaken/skip a test, use `--no-verify`, or edit CI/guards to force green.
- Keep the CI grep-guards true: no compiled `*.js` under `*/src`, no nested `packages/*/packages`,
  no `dev-secret`-style literal in source.
- Price-cap & verification logic (`packages/contracts`, `packages/database` verification engine,
  `packages/core` listing service) is safety-critical — changes require a test proving the cap holds.

## Quality bar
- TypeScript strict; no `any` leaks across package boundaries. ESLint clean.
- Validate all external input (API routes, webhooks). Webhooks verify signatures.
- Structured logs; never log secrets or PII (KYC docs).

## Living docs
- `HalfThePrice_Blueprint.md` — product/architecture blueprint.
- `README.md` — stack, local setup, env vars, API highlights.
- `deploy/DEPLOY.md`, `fly.toml` — deployment.
- `specs/constitution.md` — non-negotiable principles (CODYSTEM).
