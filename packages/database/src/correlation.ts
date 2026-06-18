import { AsyncLocalStorage } from "node:async_hooks";

export const correlationStorage = new AsyncLocalStorage<{ correlationId: string }>();

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}
