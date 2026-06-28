const USER_AGENT =
  "HalfThePriceBot/1.0 (+https://github.com/HawzhinBlanca/HalfThePrice)";

const robotsCache = new Map<string, { content: string | null; checkedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export function getCrawlerUserAgent(): string {
  return USER_AGENT;
}

/**
 * Returns true when crawling the given path is allowed per robots.txt.
 * Empty or missing robots.txt is treated as allow-all (common on CDNs).
 */
export async function isPathAllowed(
  origin: string,
  path: string,
): Promise<boolean> {
  const cached = robotsCache.get(origin);
  let content: string | null = null;
  let useCached = false;

  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    content = cached.content;
    useCached = true;
  }

  if (!useCached) {
    try {
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        content = null;
      } else {
        content = (await res.text()).trim() || null;
      }
    } catch {
      content = null;
    }
    robotsCache.set(origin, { content, checkedAt: Date.now() });
  }

  if (content === null) {
    return true;
  }

  return !bodyHasDisallowAll(content, path);
}

function bodyHasDisallowAll(robotsTxt: string, path: string): boolean {
  let inWildcardBlock = false;
  for (const line of robotsTxt.split("\n")) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith("user-agent:")) {
      const agent = trimmed.slice("user-agent:".length).trim();
      inWildcardBlock = agent === "*";
      continue;
    }
    if (!inWildcardBlock || !trimmed.startsWith("disallow:")) continue;
    const rule = trimmed.slice("disallow:".length).trim();
    if (!rule) continue;
    if (rule === "/" || path.startsWith(rule)) return true;
  }
  return false;
}

export function clearRobotsCacheForTests(): void {
  robotsCache.clear();
}
