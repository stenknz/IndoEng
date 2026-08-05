import { describe, expect, it } from "vitest";
import { WORD_BANK } from "@/lib/data/words";

describe("word bank", () => {
  it("has unique ids", () => {
    const ids = WORD_BANK.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains the survival core", () => {
    const ids = WORD_BANK.map((w) => w.id);
    for (const id of ["halo", "saya", "kamu", "makan", "minum", "air", "nasi", "ya", "tidak", "apa"]) {
      expect(ids).toContain(id);
    }
  });

  it("every word has example and pronunciation", () => {
    for (const w of WORD_BANK) {
      expect(w.example).toBeTruthy();
      expect(w.pronunciation).toBeTruthy();
    }
  });

  it("every word has a unique frequency rank", () => {
    const ranks = WORD_BANK.map((w) => w.frequency);
    expect(ranks.length).toBe(new Set(ranks).size);
    for (const r of ranks) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(WORD_BANK.length);
    }
  });
});
