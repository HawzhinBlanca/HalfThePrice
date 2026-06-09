import type { ListingStatus } from "@htp/contracts";
import type { VerificationResult } from "@prisma/client";

export function resolveListingStatusFromVerification(
  result: VerificationResult,
): ListingStatus {
  switch (result) {
    case "PASS":
      return "LIVE";
    case "FAIL":
      return "REJECTED";
    case "MANUAL_REVIEW":
      return "MANUAL_REVIEW";
    default:
      return "PENDING_VERIFICATION";
  }
}

export function canSubmitListing(status: ListingStatus): boolean {
  return status === "DRAFT" || status === "REJECTED";
}

export function canModerateListing(status: ListingStatus): boolean {
  return status === "MANUAL_REVIEW";
}

export function isPubliclyVisible(status: ListingStatus): boolean {
  return status === "LIVE";
}

export const MODERATION_SLA_HOURS = 24;

export function computeSlaStatus(
  submittedAt: Date,
  now: Date = new Date(),
): { hoursWaiting: number; breached: boolean; label: string } {
  const hoursWaiting = Math.floor(
    (now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60),
  );
  const breached = hoursWaiting >= MODERATION_SLA_HOURS;
  const label = breached
    ? `SLA breached (${hoursWaiting}h)`
    : hoursWaiting === 0
      ? "Within SLA"
      : `${hoursWaiting}h waiting`;

  return { hoursWaiting, breached, label };
}
