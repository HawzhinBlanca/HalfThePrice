export type FeatureName = "CHAT" | "CHECKOUT" | "ONBOARDING";

/**
 * Returns true if the given feature is enabled.
 * Features can be disabled by setting DISABLE_<FEATURE>=true in environment variables.
 */
export function isFeatureEnabled(feature: FeatureName): boolean {
  const envVar = `DISABLE_${feature}`;
  return process.env[envVar] !== "true";
}
