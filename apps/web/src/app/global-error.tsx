"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Automatically report the root application crash to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <head>
        <title>Application Crash</title>
      </head>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 text-center dark:bg-zinc-950">
          <div className="mb-4 rounded-full bg-red-100 p-4 text-red-600 dark:bg-red-950/20">
            <svg
              className="h-10 w-10"
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
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            A critical error occurred!
          </h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            The application experienced a critical failure. The incident has been reported automatically.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-zinc-400">
              Reference: {error.digest}
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => reset()}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Refresh application
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces the entire document; Next.js router is not mounted */}
            <a
              href="/"
              className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

