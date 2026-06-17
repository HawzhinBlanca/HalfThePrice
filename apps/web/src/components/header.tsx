import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n/messages";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoutButton } from "./logout-button";

export async function Header() {
  const [session, locale] = await Promise.all([getSession(), getLocale()]);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">
            Half<span className="text-brand-600 dark:text-brand-400">ThePrice</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label={t(locale, "nav.main")}>
          <Link
            href="/browse"
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            {t(locale, "nav.browse")}
          </Link>
          {session?.role === "SELLER" && (
            <Link
              href="/seller"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              {t(locale, "nav.sell")}
            </Link>
          )}
          {session?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              {t(locale, "nav.admin")}
            </Link>
          )}
          <LocaleSwitcher currentLocale={locale} />
          <ThemeToggle />
          {session ? (
            <div className="ml-1 flex items-center gap-2">
              <span className="hidden text-sm text-zinc-500 md:inline">{session.name}</span>
              <LogoutButton label={t(locale, "nav.signOut")} />
            </div>
          ) : (
            <Link
              href="/login"
              className="ml-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              {t(locale, "nav.signIn")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
