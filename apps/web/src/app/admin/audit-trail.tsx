"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface AuditActor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuditEvent {
  id: string;
  actorId: string | null;
  objectType: string;
  objectId: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor: AuditActor | null;
}

export function AuditTrail() {
  const { t, tf } = useI18n();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/audit?limit=30");
        const data: { data?: AuditEvent[]; error?: string } = await res.json();
        if (!res.ok) {
          setError(data.error ?? t("admin.auditFailed"));
          return;
        }
        setEvents(data.data ?? []);
      } catch {
        setError(t("admin.auditNetwork"));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [t]);

  if (loading) {
    return <p className="text-sm text-zinc-500">{t("admin.auditLoading")}</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-zinc-500">{t("admin.auditEmpty")}</p>;
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="glass rounded-xl p-4 text-sm transition hover:shadow-md"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-brand-600 dark:text-brand-400">
              {event.action}
            </span>
            <time className="text-xs text-zinc-500">
              {new Date(event.createdAt).toLocaleString()}
            </time>
          </div>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {event.objectType} · {event.objectId.slice(0, 12)}…
          </p>
          {event.actor && (
            <p className="mt-1 text-xs text-zinc-500">
              {tf("admin.auditBy", { name: event.actor.name, role: event.actor.role })}
            </p>
          )}
          {event.after != null && typeof event.after === "object" && (
            <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
              {JSON.stringify(event.after, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
