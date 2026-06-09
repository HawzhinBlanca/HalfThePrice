import { getLocale } from "@/lib/locale";
import { t, tf, type MessageKey } from "./messages";
import type { Locale } from "./types";

export async function getServerI18n(): Promise<{
  locale: Locale;
  t: (key: MessageKey) => string;
  tf: (key: MessageKey, vars?: Record<string, string | number>) => string;
}> {
  const locale = await getLocale();
  return {
    locale,
    t: (key) => t(locale, key),
    tf: (key, vars) => tf(locale, key, vars),
  };
}
