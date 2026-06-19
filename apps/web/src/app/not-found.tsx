import Link from "next/link";
import { t } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/types";
import { getLocale } from "@/lib/locale";

export default async function NotFound() {
  const locale: Locale = await getLocale();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <div className="mb-6 text-8xl font-black text-brand-600/20 dark:text-brand-400/20">
        404
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {t(locale, "notFound.title")}
      </h1>
      <p className="mt-3 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {t(locale, "notFound.description")}
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/browse"
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          {t(locale, "notFound.browseDeals")}
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t(locale, "notFound.goHome")}
        </Link>
      </div>
    </div>
  );
}
