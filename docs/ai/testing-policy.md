# Testing Policy & Quality Assurance

To maintain a 10/10 robust engineering standard, all code modifications must align with this testing strategy.

## 1. Test Architecture
The test suite is divided into three isolated layers:

| Layer | Runner | Scope | Exec command |
|---|---|---|---|
| **Unit** | Vitest | Functions, utilities, parsers, and rate limiters | `pnpm test` |
| **Integration** | Vitest | Services, DB transactions, triggers, locks | `pnpm test:integration` |
| **E2E** | Playwright | Full user journeys, accessibility audits, routing | `pnpm test:e2e` |

## 2. Integration Test Boundaries
* **Isolated Transactions:** All integration tests against the database must clean up their own rows after execution (`afterAll` or `afterEach`).
* **Advisory Lock Auditing:** Service tests (such as checkout and verification submission) must verify concurrency behavior (e.g. firing overlapping requests concurrently and proving only one succeeds).
* **Coverage Threshold:** The statement coverage floor for core packages is **90%**. Any PR that drops coverage below this floor will fail CI.

## 3. Playwright E2E Stability Rules
To prevent flaky E2E tests during parallel execution:
* **Global Seeding:** The test database is automatically re-seeded via a `globalSetup` hook before launching browser workers. Tests must not assume a blank database unless they clean up.
* **Next.js Router Stability:** Rapid keystrokes via `pressSequentially()` can trigger overlapping transitions, which Next.js Router will cancel. Always use `fill()` followed by an explicit `press("Enter")` to force stable, atomic submissions.
* **Accessibility Audits:** Dynamic pages must include accessibility audits using `axe-playwright` or equivalent tools to ensure proper semantic landmarks (like HTML5 `<nav>` elements) are preserved.
