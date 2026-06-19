"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("auth.signIn.failed"));
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass mx-auto max-w-md space-y-4 rounded-2xl p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("auth.signIn.title")}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t("auth.signIn.demo")}</p>
      </div>
      <Input
        label={t("auth.signIn.email")}
        name="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="relative">
        <Input
          label={t("auth.signIn.password")}
          name="password"
          type={showPassword ? "text" : "password"}
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label={showPassword ? t("password.hide") : t("password.show")}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("auth.signIn.submitting") : t("auth.signIn.submit")}
      </Button>
      <p className="text-center text-sm text-zinc-500">
        {t("auth.signIn.noAccount")}{" "}
        <Link href="/register" className="text-brand-600 hover:underline dark:text-brand-400">
          {t("auth.signIn.register")}
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <Suspense fallback={<div className="text-center">{t("common.loading")}</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

