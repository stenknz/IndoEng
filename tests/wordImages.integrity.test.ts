import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { WORD_BANK, categoryOrder } from "@/lib/data/words";

const ABSTRACT_CATEGORIES = new Set(["greetings", "yesno", "questions", "numbers", "likes"]);

const EXPECTED_WORDS_WITH_IMAGES = [
  "orang", "teman",
  "ibu", "ayah", "keluarga", "kakak", "adik",
  "makan", "minum", "tidur",
  "nasi", "makanan", "ayam", "ikan", "roti", "sate",
  "air", "kopi", "teh", "susu", "minuman",
  "rumah", "pintu", "kamar", "buku", "jendela", "dapur",
  "jalan", "bus", "kereta", "kantor", "sekolah", "pasar",
  "jam", "malam", "siang",
  "panas", "dingin", "hujan", "cerah", "cuaca", "mendung",
  "beli", "uang", "barang",
  "pesan", "tagihan",
];

describe("word image data integrity", () => {
  it("every expected word has an image path in the word bank", () => {
    for (const id of EXPECTED_WORDS_WITH_IMAGES) {
      const word = WORD_BANK.find((w) => w.id === id);
      expect(word, `missing word "${id}"`).toBeDefined();
      expect(word?.image, `word "${id}" missing image path`).toBeDefined();
    }
  });

  it("no abstract-category word has an image", () => {
    const offenders = WORD_BANK.filter(
      (w) => w.image && ABSTRACT_CATEGORIES.has(w.category),
    ).map((w) => w.id);
    expect(offenders).toEqual([]);
  });

  it("every image path resolves to a file in public/images", () => {
    const missing = WORD_BANK.filter((w) => w.image && w.image !== undefined).filter(
      (w) => !existsSync(join(process.cwd(), "public", w.image!)),
    ).map((w) => w.id);
    expect(missing).toEqual([]);
  });

  it("image paths match /images/<category>/<id>.jpg and categories are known", () => {
    const valid = new Set(categoryOrder);
    for (const w of WORD_BANK) {
      if (!w.image) continue;
      expect(w.image, `bad path for "${w.id}"`).toBe(
        `/images/${w.category}/${w.id}.jpg`,
      );
      expect(valid.has(w.category), `unknown category for "${w.id}"`).toBe(true);
    }
  });

  it("every file in public/images (excluding attribution files) is referenced", () => {
    const referenced = new Set(
      WORD_BANK.filter((w) => w.image).map((w) => w.image),
    );
    const base = join(process.cwd(), "public", "images");
    const orphan = new Set<string>();
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          scan(full);
        } else if (entry.endsWith(".jpg")) {
          const path = `/images/${full.slice(base.length + 1)}`;
          if (!referenced.has(path)) orphan.add(path);
        }
      }
    };
    scan(base);
    expect([...orphan]).toEqual([]);
  });
});
