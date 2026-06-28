import { afterEach, describe, expect, it, vi } from "vitest";
import { isPathAllowed, clearRobotsCacheForTests } from "./robots";

describe("robots.txt parser and caching", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearRobotsCacheForTests();
  });

  it("handles allowed and disallowed paths on same origin with cached robots.txt content", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return new Response(
          "User-agent: *\nDisallow: /admin\nDisallow: /private/",
          { status: 200 }
        );
      }
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    // First path check (allowed)
    const allowed = await isPathAllowed("https://example.com", "/public/index.html");
    expect(allowed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second path check (disallowed) - should use cache and not fetch again
    const disallowed = await isPathAllowed("https://example.com", "/admin/dashboard");
    expect(disallowed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1 because it used cached content!

    // Third path check on another origin (different fetch mock)
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const allowed2 = await isPathAllowed("https://another.com", "/admin");
    expect(allowed2).toBe(true); // Fails open on 404
  });
});
