import { HtpApiClient } from "@htp/sdk";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const api = new HtpApiClient({
  baseUrl: API_URL,
  credentials: "include",
});
