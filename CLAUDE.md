# CLAUDE.md

Operating rules for this repo live in `AGENTS.md` (the single source of truth, read natively by
Codex/Copilot/Gemini too). Imported here for Claude Code.

@AGENTS.md

## Claude-only notes
- The gate is `bash scripts/verify.sh` (guards + typecheck + lint + test + build). Run it before
  claiming anything done; only the green check (local + required CI) defines "done".
- CI (`.github/workflows/ci.yml`) is the full source of truth — it runs against a Postgres
  service and adds migrate / integration / E2E / audit / SBOM / drift on top of verify.sh.
- The codebase is indexed (cocoindex) — search for real symbols before editing; never invent APIs.
- Safety-critical: the ≤50%-of-retail price cap and KYC/verification flows — never weaken them.
