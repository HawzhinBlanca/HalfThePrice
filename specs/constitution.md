# HalfThePrice Constitution

Non-negotiable principles. CI required status checks are the mechanical source of truth.

## Core principles
- **Test-first for new logic.** No new behavior without a test for it; never weaken, skip, or
  delete a test to go green. Red → Green → Refactor.
- **Mechanical done.** A change is done only when `bash scripts/verify.sh` exits 0 locally AND
  the PR's required CI checks are green — never by an agent's self-report. `main` merges only via
  PR with green checks.
- **Smallest correct change.** No drive-by refactors outside the task. A new runtime dependency or
  architectural change is justified in the PR.
- **Safety of the price cap.** A listing is never live above 50% of verified retail. Any change to
  the price-cap / verification engine (`packages/contracts`, `packages/database`, `packages/core`)
  ships with a test proving the cap and quorum still hold.
- **Security.** Validate all external input; verify webhook signatures; never log or commit secrets
  or KYC/PII; keep the CI grep-guards true (no leaked `.js`, no nested packages, no secret literals).
- **Observability.** Non-trivial paths emit structured logs; `/api/health` reflects real dependency
  health.

## Governance
This constitution supersedes ad-hoc practice. Every PR must comply; unjustified complexity is
rejected. Amendments are made in a PR that updates this file.

**Version**: 1.0.0 | **Ratified**: 2026-06-29
