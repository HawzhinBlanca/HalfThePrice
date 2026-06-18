import { prisma } from "@htp/database";

export type FeatureName = "CHAT" | "CHECKOUT" | "ONBOARDING" | "CRAWLER_LIVE";

/**
 * Returns true if the given feature is enabled according to environment variables.
 */
export function isFeatureEnabled(feature: FeatureName): boolean {
  const envVar = `DISABLE_${feature}`;
  return process.env[envVar] !== "true";
}

/**
 * Returns true if the given feature is enabled.
 * First checks environment variables, then falls back to checking the database
 * for dynamic, runtime kill-switch controls without needing a redeployment.
 */
export async function isFeatureEnabledAsync(feature: FeatureName): Promise<boolean> {
  // Check environment variables first (fast path / local overrides)
  if (!isFeatureEnabled(feature)) {
    return false;
  }

  // Check database for dynamic runtime control
  try {
    const flag = await prisma.featureFlag.findUnique({
      where: { key: feature },
    });
    if (flag) {
      return flag.enabled;
    }
  } catch (error) {
    console.error(`Failed to fetch feature flag ${feature} from database:`, error);
  }

  return true;
}
