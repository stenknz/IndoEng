import { describe, expect, it } from "vitest";
import { LESSONS } from "@/lib/data/lessons";
import { WORD_BANK } from "@/lib/data/words";

const ids = new Set(WORD_BANK.map((w) => w.id));

describe("lessons", () => {
  it("has exactly 12 lessons in order", () => {
    expect(LESSONS).toHaveLength(12);
    expect(LESSONS.map((l) => l.order)).toEqual([...LESSONS].map((_, i) => i + 1));
  });

  it("new words are cumulative and warm-up references earlier lessons", () => {
    const known = new Set<string>();
    for (const lesson of LESSONS) {
      for (const id of lesson.warmUpIds) {
        expect(known.has(id), `warm-up ${id} in ${lesson.title}`).toBe(true);
      }
      for (const id of lesson.newWordIds) {
        expect(ids.has(id), `unknown word ${id} in ${lesson.title}`).toBe(true);
        known.add(id);
      }
      expect(lesson.newWordIds.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("practice and recall are non-empty", () => {
    for (const lesson of LESSONS) {
      expect(lesson.practice.length).toBeGreaterThanOrEqual(3);
      expect(lesson.recall.length).toBeGreaterThanOrEqual(3);
    }
  });
});
