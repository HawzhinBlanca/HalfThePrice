"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get("role") === "seller" ? "SELLER" : "BUYER";
  const { t } = useI18n();

  const [role, setRole] = useState<"BUYER" | "SELLER">(defaultRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [governorate, setGovernorate] = useState("Baghdad");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          ...(role === "SELLER" ? { governorate, legalName: name, displayName: name } : {}),
        }),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("auth.register.failed"));
        return;
      }

      router.push(role === "SELLER" ? "/seller" : "/browse");
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
        <h1 className="text-2xl font-bold">{t("auth.register.title")}</h1>
      </div>
      <Select
        label={t("auth.register.accountType")}
        name="role"
        options={[
          { value: "BUYER", label: t("auth.register.buyer") },
          { value: "SELLER", label: t("auth.register.seller") },
        ]}
        value={role}
        onChange={(e) => setRole(e.target.value as "BUYER" | "SELLER")}
      />
      <Input
        label={t("auth.register.fullName")}
        name="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        label={t("auth.register.email")}
        name="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label={t("auth.register.password")}
        name="password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {role === "SELLER" && (
        <Input
          label={t("auth.register.governorate")}
          name="governorate"
          required
          value={governorate}
          onChange={(e) => setGovernorate(e.target.value)}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("auth.register.submitting") : t("auth.register.submit")}
      </Button>
      <p className="text-center text-sm text-zinc-500">
        {t("auth.register.hasAccount")}{" "}
        <Link href="/login" className="text-brand-600 hover:underline dark:text-brand-400">
          {t("auth.register.signIn")}
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <Suspense fallback={<div className="text-center">{t("common.loading")}</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
