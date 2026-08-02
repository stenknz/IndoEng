export interface MatchResult {
  correct: boolean | "partial";
  matched: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/-/g, " ").replace(/[.,!?]/g, "");
}

export function matchAnswer(
  input: string,
  expected: string[],
): MatchResult {
  const normalizedInput = normalize(input);
  const words = normalizedInput.split(/\s+/);
  const matched = expected.filter((e) => {
    const n = normalize(e);
    // Multi-word phrases (e.g. "selamat pagi") match as a whole phrase in the
    // input; single words match as an individual token.
    return n.includes(" ") ? normalizedInput.includes(n) : words.includes(n);
  });
  if (matched.length === expected.length) return { correct: true, matched };
  if (matched.length > 0) return { correct: "partial", matched };
  return { correct: false, matched };
}
