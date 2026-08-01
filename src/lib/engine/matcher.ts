export interface MatchResult {
  correct: boolean | "partial";
  matched: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[.,!?]/g, "");
}

export function matchAnswer(
  input: string,
  expected: string[],
): MatchResult {
  const words = normalize(input).split(/\s+/);
  const matched = expected.filter((e) => words.includes(normalize(e)));
  if (matched.length === expected.length) return { correct: true, matched };
  if (matched.length > 0) return { correct: "partial", matched };
  return { correct: false, matched };
}
