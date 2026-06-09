import { escapeHtml } from "@/lib/sanitize";
import { getSearchHighlightTerms } from "@/lib/search";

interface HighlightedTextProps {
  text: string;
  query?: string;
  className?: string;
}

export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  if (!query?.trim()) {
    return <span className={className}>{text}</span>;
  }

  const terms = getSearchHighlightTerms(query);
  if (terms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );

  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
        if (isMatch) {
          return (
            <mark
              key={`${part}-${index}`}
              className="rounded bg-brand-200/80 px-0.5 font-medium text-brand-900 dark:bg-brand-800/60 dark:text-brand-100"
            >
              {part}
            </mark>
          );
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </span>
  );
}

/** Safe HTML highlight for server-rendered strings (unused in React tree). */
export function highlightSearchHtml(text: string, query: string): string {
  const terms = getSearchHighlightTerms(query);
  if (terms.length === 0) return escapeHtml(text);

  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );

  return escapeHtml(text).replace(
    pattern,
    '<mark class="rounded bg-brand-200/80 px-0.5 font-medium text-brand-900 dark:bg-brand-800/60 dark:text-brand-100">$1</mark>',
  );
}
