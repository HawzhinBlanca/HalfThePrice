import { describe, expect, it } from "vitest";
import {
  canModerateListing,
  canSubmitListing,
  computeSlaStatus,
  isPubliclyVisible,
  MODERATION_SLA_HOURS,
  resolveListingStatusFromVerification,
} from "./state-machine";

describe("verification state machine", () => {
  it("maps verification results to listing statuses", () => {
    expect(resolveListingStatusFromVerification("PASS")).toBe("LIVE");
    expect(resolveListingStatusFromVerification("FAIL")).toBe("REJECTED");
    expect(resolveListingStatusFromVerification("MANUAL_REVIEW")).toBe("MANUAL_REVIEW");
    expect(resolveListingStatusFromVerification("PENDING")).toBe("PENDING_VERIFICATION");
  });

  it("controls submit eligibility", () => {
    expect(canSubmitListing("DRAFT")).toBe(true);
    expect(canSubmitListing("REJECTED")).toBe(true);
    expect(canSubmitListing("LIVE")).toBe(false);
    expect(canSubmitListing("MANUAL_REVIEW")).toBe(false);
  });

  it("controls moderation eligibility", () => {
    expect(canModerateListing("MANUAL_REVIEW")).toBe(true);
    expect(canModerateListing("LIVE")).toBe(false);
  });

  it("determines public visibility", () => {
    expect(isPubliclyVisible("LIVE")).toBe(true);
    expect(isPubliclyVisible("STALE")).toBe(false);
    expect(isPubliclyVisible("HIDDEN")).toBe(false);
  });
});

describe("moderation SLA", () => {
  it("reports within SLA for recent submissions", () => {
    const now = new Date("2026-06-09T12:00:00Z");
    const submitted = new Date("2026-06-09T10:00:00Z");
    const sla = computeSlaStatus(submitted, now);
    expect(sla.breached).toBe(false);
    expect(sla.hoursWaiting).toBe(2);
  });

  it("flags SLA breach after threshold", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const submitted = new Date("2026-06-08T12:00:00Z");
    const sla = computeSlaStatus(submitted, now);
    expect(sla.breached).toBe(true);
    expect(sla.hoursWaiting).toBeGreaterThanOrEqual(MODERATION_SLA_HOURS);
  });
});
