import type { Locale } from "./i18n/types";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "CSRF_INVALID"
  | "OFFER_CAP_EXCEEDED"
  | "LISTING_UNAVAILABLE"
  | "ORDER_INVALID"
  | "PAYMENT_FAILED"
  | "INTERNAL_ERROR";

const messages: Record<ApiErrorCode, Record<Locale, string>> = {
  UNAUTHORIZED: {
    en: "You must be signed in.",
    ar: "يجب تسجيل الدخول.",
    ku: "پێویستە بچیتە ژوورەوە.",
  },
  FORBIDDEN: {
    en: "You do not have permission for this action.",
    ar: "ليس لديك صلاحية لهذا الإجراء.",
    ku: "مۆڵەتت نییە بۆ ئەم کردارە.",
  },
  NOT_FOUND: {
    en: "The requested resource was not found.",
    ar: "المورد المطلوب غير موجود.",
    ku: "سەرچاوەکە نەدۆزرایەوە.",
  },
  INVALID_INPUT: {
    en: "Invalid input. Please check your data.",
    ar: "إدخال غير صالح. يرجى التحقق من البيانات.",
    ku: "داتای نادروست. تکایە پشکنین بکە.",
  },
  RATE_LIMITED: {
    en: "Too many requests. Please try again later.",
    ar: "طلبات كثيرة. حاول لاحقاً.",
    ku: "داواکاری زۆر. دواتر هەوڵ بدەرەوە.",
  },
  CSRF_INVALID: {
    en: "Security token invalid. Refresh and try again.",
    ar: "رمز الأمان غير صالح. حدّث الصفحة وحاول مجدداً.",
    ku: "نیشانەی ئاسایش نادروستە. پەڕەکە نوێ بکەرەوە.",
  },
  OFFER_CAP_EXCEEDED: {
    en: "Offer exceeds the verified price cap.",
    ar: "العرض يتجاوز سقف السعر الموثق.",
    ku: "پێشنیار لە سنووری نرخی پشتڕاستکراو تێدەپەڕێت.",
  },
  LISTING_UNAVAILABLE: {
    en: "Listing not found or not available.",
    ar: "الإعلان غير موجود أو غير متاح.",
    ku: "ڕیکلامەکە بەردەست نییە.",
  },
  ORDER_INVALID: {
    en: "Order cannot be processed in its current state.",
    ar: "لا يمكن معالجة الطلب في حالته الحالية.",
    ku: "داواکاری لەم دۆخەدا ناتوانرێت جێبەجێ بکرێت.",
  },
  PAYMENT_FAILED: {
    en: "Payment could not be completed.",
    ar: "تعذر إتمام الدفع.",
    ku: "پارەدان تەواو نەبوو.",
  },
  INTERNAL_ERROR: {
    en: "Something went wrong. Please try again.",
    ar: "حدث خطأ. حاول مرة أخرى.",
    ku: "هەڵەیەک ڕوویدا. دووبارە هەوڵ بدەرەوە.",
  },
};

export function getErrorMessage(
  code: ApiErrorCode,
  locale: Locale = "en",
): string {
  return messages[code][locale] ?? messages[code].en;
}

export function resolveLocale(
  headerLocale: string | null,
  cookieLocale?: string | null,
): Locale {
  const candidate = headerLocale ?? cookieLocale ?? "en";
  if (candidate === "ar" || candidate === "ku") return candidate;
  return "en";
}
