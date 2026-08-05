import { describe, expect, it } from "vitest";
import { DICTIONARY, searchDictionary } from "@/lib/data/dictionary";

describe("dictionary", () => {
  it("contains entries beyond the word bank (common phrases)", () => {
    const ids = DICTIONARY.map((e) => e.id);
    expect(ids).toContain("apa kabar");
    expect(ids).toContain("bisa");
    expect(ids).toContain("sudah");
  });

  it("returns empty results for an empty query", () => {
    expect(searchDictionary("")).toEqual([]);
    expect(searchDictionary("   ")).toEqual([]);
  });

  it("matches Indonesian and returns it first", () => {
    const r = searchDictionary("nasi");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].indonesian).toBe("nasi");
  });

  it("matches English queries", () => {
    const r = searchDictionary("thank you");
    expect(r[0].indonesian).toBe("terima kasih");
  });

  it("matches synonyms and alternatives", () => {
    expect(searchDictionary("makasih")[0].indonesian).toBe("terima kasih");
    expect(searchDictionary("fried rice")[0].id).toBe("nasi");
  });

  it("returns nothing for gibberish", () => {
    expect(searchDictionary("zzzzzqqq")).toEqual([]);
  });

  it("respects the result limit", () => {
    const r = searchDictionary("a", 5);
    expect(r.length).toBeLessThanOrEqual(5);
  });
});
