import { normalizeSearchQuery } from "./sanitize";

const TYPO_SUBSTITUTIONS: Record<string, string[]> = {
  a: ["e", "o"],
  e: ["a", "i"],
  i: ["e", "y"],
  o: ["a", "u"],
  u: ["o"],
  c: ["k", "s"],
  k: ["c", "q"],
  s: ["c", "z"],
  z: ["s"],
  f: ["ph"],
  g: ["j"],
  j: ["g"],
  m: ["n"],
  n: ["m"],
};

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

export function generateFuzzyVariants(token: string): string[] {
  if (token.length < 3) return [token];

  const variants = new Set<string>([token]);

  for (let i = 0; i < token.length; i++) {
    variants.add(token.slice(0, i) + token.slice(i + 1));
  }

  for (let i = 0; i < token.length - 1; i++) {
    const chars = token.split("");
    [chars[i], chars[i + 1]] = [chars[i + 1]!, chars[i]!];
    variants.add(chars.join(""));
  }

  for (let i = 0; i < token.length; i++) {
    const char = token[i]!;
    const subs = TYPO_SUBSTITUTIONS[char];
    if (subs) {
      for (const sub of subs) {
        variants.add(token.slice(0, i) + sub + token.slice(i + 1));
      }
    }
  }

  return [...variants].filter((v) => v.length >= 2);
}

/** Token groups: each inner array is OR-variants for one query word. */
export function expandFuzzyTokenGroups(query: string): string[][] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .filter((token) => token.length >= 2)
    .map((token) => [...new Set(generateFuzzyVariants(token))]);
}

export function tokenMatchesText(token: string, text: string): boolean {
  const normalizedText = normalizeSearchQuery(text);
  if (normalizedText.includes(token)) return true;

  const words = normalizedText.split(" ");
  return words.some(
    (word) =>
      word.startsWith(token) ||
      (word.length >= 3 && token.length >= 3 && levenshteinDistance(word, token) <= 1),
  );
}

export function queryMatchesText(query: string, text: string): boolean {
  const groups = expandFuzzyTokenGroups(query);
  if (groups.length === 0) {
    const normalized = normalizeSearchQuery(query);
    return normalized.length > 0 && normalizeSearchQuery(text).includes(normalized);
  }

  return groups.every((group) => group.some((variant) => tokenMatchesText(variant, text)));
}

export function getSearchHighlightTerms(query: string): string[] {
  const groups = expandFuzzyTokenGroups(query);
  if (groups.length === 0) {
    const normalized = normalizeSearchQuery(query);
    return normalized ? [normalized] : [];
  }
  return groups.flat();
}
