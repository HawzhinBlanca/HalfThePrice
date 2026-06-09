import { ar } from "./ar";
import { en } from "./en";
import { ku } from "./ku";
import type { Locale } from "../types";
import type { MessageKey, Messages } from "./types";

export type { MessageKey, Messages };

export const messages: Record<Locale, Messages> = { en, ar, ku };

export function t(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages.en[key];
}

export function tf(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = t(locale, key);
  if (!vars) return text;

  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}
