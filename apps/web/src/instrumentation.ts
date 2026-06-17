export async function register() {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION === "true"
  ) {
    return;
  }

  // Boot-time environment variable validation
  const requiredEnv = ["DATABASE_URL", "NEXTAUTH_SECRET", "PAYMENT_WEBHOOK_SECRET"];
  
  for (const envName of requiredEnv) {
    const value = process.env[envName];
    if (!value) {
      throw new Error(`CRITICAL CONFIG ERROR: Required environment variable ${envName} is missing.`);
    }
  }

  if (process.env.NODE_ENV === "production") {
    const insecureDefaults: Record<string, string> = {
      NEXTAUTH_SECRET: "change-me-in-production-use-openssl-rand-base64-32",
      PAYMENT_WEBHOOK_SECRET: "change-me-for-payment-webhooks",
      CRON_SECRET: "change-me-for-stale-listing-cron",
      CENTRIFUGO_TOKEN_SECRET: "htp_centrifugo_dev_secret",
    };

    for (const [envName, defaultValue] of Object.entries(insecureDefaults)) {
      const value = process.env[envName];
      if (value === defaultValue) {
        throw new Error(`CRITICAL CONFIG ERROR: Environment variable ${envName} is set to the insecure default value. Please change it in production.`);
      }
    }
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
