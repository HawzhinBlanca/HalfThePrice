import type { PaginatedResponse } from "@htp/contracts";

export interface ApiClientConfig {
  baseUrl: string;
  credentials?: RequestCredentials;
}

export interface ListingSummary {
  id: string;
  title: string;
  sellerPriceIqd: number;
  governorate: string;
  imageUrl: string | null;
  category?: { nameEn: string; slug: string };
}

export interface SessionResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
}

export class HtpApiClient {
  constructor(private config: ApiClientConfig) {}

  private url(path: string): string {
    return `${this.config.baseUrl.replace(/\/$/, "")}${path}`;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(this.url(path), {
      ...init,
      credentials: this.config.credentials ?? "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      throw new Error(body.error ?? `Request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  getListings(params?: {
    q?: string;
    page?: number;
    limit?: number;
    categoryId?: string;
    governorate?: string;
  }): Promise<PaginatedResponse<ListingSummary>> {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.categoryId) search.set("categoryId", params.categoryId);
    if (params?.governorate) search.set("governorate", params.governorate);
    const qs = search.toString();
    return this.fetch(`/api/listings${qs ? `?${qs}` : ""}`);
  }

  getListing(id: string): Promise<ListingSummary> {
    return this.fetch(`/api/listings/${id}`);
  }

  getSession(): Promise<SessionResponse> {
    return this.fetch("/api/auth/session");
  }

  login(email: string, password: string): Promise<SessionResponse> {
    return this.fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  getSellerListings(): Promise<{ data: ListingSummary[] }> {
    return this.fetch("/api/seller/listings");
  }
}

export { formatIqd } from "@htp/contracts";
