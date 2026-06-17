"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutatingFetch } from "@/lib/use-csrf";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await mutatingFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors — navigate home regardless so the UI reflects the
      // cleared session on the next load.
    }
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {label}
    </button>
  );
}
