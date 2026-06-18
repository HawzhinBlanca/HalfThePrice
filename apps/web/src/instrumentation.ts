import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION === "true"
  ) {
    return;
  }

  // Boot-time environment variable validation
  const requiredEnv = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "PAYMENT_WEBHOOK_SECRET",
    "CENTRIFUGO_TOKEN_SECRET",
    "CENTRIFUGO_API_KEY",
    "CRON_SECRET"
  ];
  
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
      CENTRIFUGO_API_KEY: "htp_centrifugo_api_key",
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

export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: "pages" | "app";
    routeType: "layout" | "page" | "route" | "action";
  }
) {
  Sentry.captureException(err, {
    extra: {
      request,
      context,
    },
  });
}
