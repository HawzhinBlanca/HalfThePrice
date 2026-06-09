"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";
import { mutatingFetch } from "@/lib/use-csrf";

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface ListingChatProps {
  listingId: string;
  userId: string;
}

export function ListingChat({ listingId, userId }: ListingChatProps) {
  const { t } = useI18n();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await mutatingFetch("/api/chat/conversations", {
          method: "POST",
          body: JSON.stringify({ listingId }),
        });
        const data = (await res.json()) as {
          conversation: { id: string; messages: Message[] };
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? t("chat.unavailable"));
          return;
        }
        if (!cancelled) {
          setConversationId(data.conversation.id);
          setMessages(data.conversation.messages ?? []);
        }
      } catch {
        if (!cancelled) setError(t("chat.unavailable"));
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [listingId, t]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!conversationId || !content.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await mutatingFetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content: content.trim() }),
        },
      );
      const data = (await res.json()) as Message & { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("chat.sendFailed"));
        return;
      }
      setMessages((prev) => [...prev, data]);
      setContent("");
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  if (error && !conversationId) {
    return (
      <p className="text-sm text-zinc-500">{error}</p>
    );
  }

  return (
    <div className="glass space-y-4 rounded-2xl p-6">
      <h2 className="font-semibold">{t("chat.title")}</h2>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("chat.empty")}</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                msg.senderId === userId
                  ? "ml-8 bg-brand-100 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100"
                  : "mr-8 bg-zinc-100 dark:bg-zinc-800"
              }`}
            >
              {msg.content}
            </div>
          ))
        )}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <Input
          name="message"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !content.trim()}>
          {t("chat.send")}
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
