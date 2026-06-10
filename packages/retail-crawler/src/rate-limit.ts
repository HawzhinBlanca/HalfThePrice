const lastRequestAt = new Map<string, number>();

export async function throttle(
  key: string,
  minIntervalMs: number,
): Promise<void> {
  const now = Date.now();
  const last = lastRequestAt.get(key) ?? 0;
  const wait = minIntervalMs - (now - last);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt.set(key, Date.now());
}
