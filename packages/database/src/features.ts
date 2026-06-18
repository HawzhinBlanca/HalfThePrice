import { prisma } from "./client";

export async function isDatabaseFeatureEnabled(key: string): Promise<boolean> {
  const envVar = `DISABLE_${key}`;
  if (process.env[envVar] === "true") {
    return false;
  }
  try {
    const flag = await prisma.featureFlag.findUnique({
      where: { key },
    });
    if (flag) {
      return flag.enabled;
    }
  } catch (error) {
    console.error(`Failed to fetch database feature flag ${key}:`, error);
  }
  return true;
}
