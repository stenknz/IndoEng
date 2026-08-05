export interface MatchResult {
  correct: boolean | "partial";
  matched: string[];
}

const NEGATIONS = new Set(["tidak", "bukan", "nggak", "gak", "jangan"]);

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/-/g, " ").replace(/[.,!?]/g, "");
}

function tokenize(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean);
}

export function matchAnswer(
  input: string,
  expected: string[],
): MatchResult {
  const inputTokens = tokenize(input);
  const normalizedInput = normalize(input);
  const matched = expected.filter((e) => {
    const n = normalize(e);
    // Multi-word phrases (e.g. "selamat pagi") match as a whole phrase in the
    // input; single words match as an individual token.
    return n.includes(" ") ? normalizedInput.includes(n) : inputTokens.includes(n);
  });
  // Guard against negation: if the learner used a negation word that was NOT
  // part of the expected answer, the answer is semantically wrong even if the
  // expected tokens appear. ("Saya tidak makan ayam" for expected "makan ayam".)
  const expectedTokens = new Set(expected.flatMap((e) => tokenize(e)));
  const negated = inputTokens.some(
    (t) => NEGATIONS.has(t) && !expectedTokens.has(t),
  );
  if (negated) return { correct: false, matched: [] };
  if (matched.length === expected.length) return { correct: true, matched };
  if (matched.length > 0) return { correct: "partial", matched };
  return { correct: false, matched };
}
