import type { Prisma } from "@prisma/client";

export function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export async function acquireAdvisoryLock(
  tx: {
    $executeRaw: (
      strings: TemplateStringsArray,
      ...values: any[]
    ) => Promise<any>;
  },
  key: string,
): Promise<void> {
  const lockId = hashStringToInt(key);
  // pg_advisory_xact_lock acquires a transaction-level lock that releases automatically when the transaction completes.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
}
