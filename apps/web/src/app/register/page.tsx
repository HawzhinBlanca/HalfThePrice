"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const strengthColor = passwordStrength <= 1 ? "bg-red-500" : passwordStrength === 2 ? "bg-amber-500" : "bg-green-500";
  const strengthLabel = (passwordStrength <= 1 ? "password.strength.weak" : passwordStrength === 2 ? "password.strength.medium" : "password.strength.strong") as "password.strength.weak" | "password.strength.medium" | "password.strength.strong";

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
      <div className="relative">
        <Input
          label={t("auth.register.password")}
          name="password"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
      {/* Password strength indicator */}
      {password.length > 0 && (
        <div className="space-y-1">
          <div className="flex h-1.5 gap-1">
            <div className={`flex-1 rounded-full transition ${passwordStrength >= 1 ? strengthColor : "bg-zinc-200 dark:bg-zinc-700"}`} />
            <div className={`flex-1 rounded-full transition ${passwordStrength >= 2 ? strengthColor : "bg-zinc-200 dark:bg-zinc-700"}`} />
            <div className={`flex-1 rounded-full transition ${passwordStrength >= 3 ? strengthColor : "bg-zinc-200 dark:bg-zinc-700"}`} />
          </div>
          <p className={`text-xs ${strengthColor === "bg-red-500" ? "text-red-500" : strengthColor === "bg-amber-500" ? "text-amber-500" : "text-green-500"}`}>
            {t(strengthLabel)}
          </p>
        </div>
      )}
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
