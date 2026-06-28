# Platform Security & Audit Policy

This document details the critical security layers that must remain active across the application.

## 1. CSRF Protection
* **Guards:** All mutating request methods (`POST`, `PUT`, `DELETE`, `PATCH`) must validate the `x-csrf-token` header against the secure cookie signature.
* **Negative Testing:** The E2E suite contains negative tests (`csrf-negative.spec.ts`) verifying that requests lacking tokens or containing mismatched tokens are blocked with a `403 Forbidden` status.

## 2. Cryptographic Webhook Auditing
* **Signature Verification:** We use HMAC-SHA256 signatures generated from the webhook payload and shared secret.
* **Timing-Safe Checks:** Comparisons use `crypto.timingSafeEqual` to prevent side-channel timing attacks.
* **Length Guard:** To avoid Node.js exceptions when comparing mismatching lengths, the handler must check:
  `if (signature.length !== expected.length) return false;`
* **Timestamp Replay Guard:** The webhook headers must contain `x-htp-timestamp` to enforce a 5-minute (300-second) window, preventing callback replay attacks.

## 3. Rate Limiting & Resource Protection
* **Pruning Memory Leaks:** The in-memory Rate Limit store uses a Map. To prevent out-of-memory (OOM) degradation, entries are pruned during check invocations (5% random chance) when they expire.
* **Circuit Breaker:** If the rate limiting service fails (e.g. network lost), it must fail-open to ensure service availability while logging structured warnings.

## 4. Traceability (Correlation IDs)
* **Propagation:** Every API handler is wrapped with `withCorrelation`. The middleware generates a unique `x-correlation-id` header per request.
* **Database Tracing:** Prisma logs and `AuditEvent` database entries automatically capture the active correlation ID using node's `AsyncLocalStorage`, allowing operations engineers to trace a database write directly to the originating HTTP request.
