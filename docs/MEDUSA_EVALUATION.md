# Medusa evaluation (Track H)

## Decision

**Medusa is not required for the current HalfThePrice MVP.** The existing Next.js + Prisma commerce layer suffices for v1 scope.

## Rationale

The blueprint recommends Medusa for policy-driven commerce and workflow orchestration. Our MVP already encodes the critical publication gatekeeper in `packages/database/src/verification.ts` and Prisma state machines — independent of a commerce framework.

| Concern | Medusa | Current stack |
|---------|--------|---------------|
| Listing lifecycle (draft → verify → live) | Custom module/workflow | Prisma + verification engine ✅ |
| Offers & orders | Native cart/checkout modules | Offer + Order models ✅ |
| Admin moderation | Extensible admin | `/admin` console ✅ |
| Payment adapters | Plugin pattern | `@htp/payments` sandbox layer ✅ |
| Operational complexity | Separate commerce service | Single Next.js deploy ✅ |

## What we implemented instead

- `Order` and `PaymentIntent` models in Prisma
- Sandbox providers for ZainCash, QiCard, FastPay, COD
- Checkout flow: offer → accept → pay → confirmed
- Webhook routes with HMAC signature verification

## When to revisit Medusa

Consider Medusa 2.x if we need:

- Multi-region inventory and fulfillment workflows
- Native marketplace split payouts (after licensed gateway contracts)
- Plugin ecosystem for promotions, returns, and tax engines
- Durable workflow engine for complex manual-review SLAs

Until then, adding Medusa would duplicate primitives without accelerating the core 50% cap verification mission.
