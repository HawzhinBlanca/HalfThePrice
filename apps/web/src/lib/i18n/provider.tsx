"use client";

import { createContext, useContext, useMemo } from "react";
import { messages, t, tf, type MessageKey } from "./messages";
import type { Locale } from "./types";

interface I18nContextValue {
  locale: Locale;
  t: (key: MessageKey) => string;
  tf: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key) => t(locale, key),
      tf: (key, vars) => tf(locale, key, vars),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useI18nOptional(): I18nContextValue | null {
  return useContext(I18nContext);
}

/** Client-safe message lookup when provider may be absent (e.g. tests). */
export function clientT(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages.en[key];
}
