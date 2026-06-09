import { ShieldCheck } from "lucide-react";
import { t } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

interface VerificationBadgeProps {
  className?: string;
  size?: "sm" | "md";
  locale: Locale;
}

export function VerificationBadge({ className, size = "sm", locale }: VerificationBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-brand-600/10 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className,
      )}
    >
      <ShieldCheck className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      {t(locale, "verification.badge")}
    </span>
  );
}
