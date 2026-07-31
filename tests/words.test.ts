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
});
