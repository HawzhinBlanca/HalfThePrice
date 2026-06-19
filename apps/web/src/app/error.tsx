"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { useI18n } from "@/lib/i18n/provider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    // Automatically report the layout/page crash to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-4 text-center">
      <div className="mb-4 rounded-full bg-red-50 p-3 text-red-600 dark:bg-red-950/30">
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
        {t("error.title")}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {t("error.description")}
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-zinc-400">
          {t("error.reference")}: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          {t("error.tryAgain")}
        </button>
        <Link
          href="/"
          className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t("error.goHome")}
        </Link>
      </div>
    </div>
  );
}
