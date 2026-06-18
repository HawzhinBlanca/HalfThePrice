import { SignJWT } from "jose";

export function getCentrifugoConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  
  const tokenSecret = process.env.CENTRIFUGO_TOKEN_SECRET;
  if (!tokenSecret && isProduction) {
    throw new Error("CENTRIFUGO_TOKEN_SECRET environment variable is missing in production.");
  }
  
  const apiKey = process.env.CENTRIFUGO_API_KEY;
  if (!apiKey && isProduction) {
    throw new Error("CENTRIFUGO_API_KEY environment variable is missing in production.");
  }

  return {
    apiUrl: process.env.CENTRIFUGO_API_URL ?? "http://localhost:8000",
    wsUrl: process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL ?? "ws://localhost:8000/connection/websocket",
    tokenSecret: isProduction ? tokenSecret! : (tokenSecret ?? "htp_centrifugo_dev_secret"),
    apiKey: isProduction ? apiKey! : (apiKey ?? "htp_centrifugo_api_key"),
  };
}

export function conversationChannel(conversationId: string): string {
  return `chat:${conversationId}`;
}

export async function createCentrifugoToken(params: {
  userId: string;
  channels: string[];
  expiresIn?: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(getCentrifugoConfig().tokenSecret);

  return new SignJWT({
    sub: params.userId,
    channels: params.channels,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(params.expiresIn ?? "1h")
    .sign(secret);
}

export async function publishToChannel(
  channel: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { apiUrl, apiKey } = getCentrifugoConfig();

  const response = await fetch(`${apiUrl}/api/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `apikey ${apiKey}`,
    },
    body: JSON.stringify({ channel, data }),
  });

  if (!response.ok) {
    throw new Error(`Centrifugo publish failed: ${response.status}`);
  }
}
