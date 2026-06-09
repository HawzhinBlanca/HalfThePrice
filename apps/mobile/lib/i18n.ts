export type MobileLocale = "en" | "ar" | "ku";

const messages: Record<MobileLocale, Record<string, string>> = {
  en: {
    browse: "Browse",
    login: "Login",
    seller: "Seller",
    loading: "Loading...",
    signIn: "Sign in",
    email: "Email",
    password: "Password",
    listings: "Listings",
    noListings: "No listings found",
    price: "Price",
    governorate: "Governorate",
  },
  ar: {
    browse: "تصفح",
    login: "تسجيل الدخول",
    seller: "البائع",
    loading: "جاري التحميل...",
    signIn: "دخول",
    email: "البريد",
    password: "كلمة المرور",
    listings: "الإعلانات",
    noListings: "لا إعلانات",
    price: "السعر",
    governorate: "المحافظة",
  },
  ku: {
    browse: "گەڕان",
    login: "چوونەژوورەوە",
    seller: "فرۆشیار",
    loading: "بارکردن...",
    signIn: "چوونەژوورەوە",
    email: "ئیمەیڵ",
    password: "وشەی نهێنی",
    listings: "ڕیکلامەکان",
    noListings: "ڕیکلام نییە",
    price: "نرخ",
    governorate: "پارێزگا",
  },
};

let locale: MobileLocale = "en";

export function setLocale(l: MobileLocale) {
  locale = l;
}

export function t(key: string): string {
  return messages[locale][key] ?? messages.en[key] ?? key;
}
