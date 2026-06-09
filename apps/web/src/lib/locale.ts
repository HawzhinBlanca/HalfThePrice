import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { type Locale, getLocaleDir } from "@/lib/i18n/types";

const VALID_LOCALES = new Set<Locale>(["en", "ar", "ku"]);

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  if (value && VALID_LOCALES.has(value as Locale)) {
    return value as Locale;
  }
  return "en";
}

export async function getLocaleAttributes(): Promise<{
  locale: Locale;
  dir: "ltr" | "rtl";
}> {
  const locale = await getLocale();
  return { locale, dir: getLocaleDir(locale) };
}
