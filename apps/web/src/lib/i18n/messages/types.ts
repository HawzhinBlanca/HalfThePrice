import type { en } from "./en";

export type MessageKey = keyof typeof en;
export type Messages = { [K in MessageKey]: string };
