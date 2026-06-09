"use client";

import { CSRF_HEADER } from "./constants";

let cachedToken: string | null = null;

export async function fetchCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch("/api/csrf");
  const data = (await res.json()) as { token: string };
  cachedToken = data.token;
  return data.token;
}

export async function mutatingFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await fetchCsrfToken();
  const headers = new Headers(init?.headers);
  headers.set(CSRF_HEADER, token);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
