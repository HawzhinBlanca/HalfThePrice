import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import { Header } from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n/provider";
import { t } from "@/lib/i18n/messages";
import { getLocaleAttributes } from "@/lib/locale";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getLocaleAttributes();
  return {
    title: t(locale, "meta.title"),
    description: t(locale, "meta.description"),
    openGraph: {
      title: t(locale, "meta.title"),
      description: t(locale, "meta.description"),
      locale,
      type: "website",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, dir } = await getLocaleAttributes();
  const { t: tr } = { t: (key: Parameters<typeof t>[1]) => t(locale, key) };

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${inter.variable} ${notoArabic.variable} font-sans min-h-screen`}>
        <ThemeProvider>
          <I18nProvider locale={locale}>
            <Header />
            <main>{children}</main>
            <footer className="border-t border-zinc-200 py-10 dark:border-zinc-800">
              <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
                  <p className="text-sm text-zinc-500">{tr("footer.tagline")}</p>
                  <nav className="flex gap-4 text-sm text-zinc-500" aria-label={tr("nav.footer")}>
                    <a href="/browse" className="hover:text-zinc-900 dark:hover:text-white">
                      {tr("nav.browse")}
                    </a>
                    <a
                      href="/register?role=seller"
                      className="hover:text-zinc-900 dark:hover:text-white"
                    >
                      {tr("nav.sell")}
                    </a>
                  </nav>
                </div>
              </div>
            </footer>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
