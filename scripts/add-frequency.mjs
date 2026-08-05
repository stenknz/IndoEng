import { readFileSync, writeFileSync } from "node:fs";

const file = "src/lib/data/words.ts";
const text = readFileSync(file, "utf8");
const lines = text.split("\n");

// Pedagogical frequency order (rank 1 = most frequent), approximating
// Indonesian corpus frequency for this survival vocabulary set.
const FREQUENCY = [
  "saya", "kamu", "ini", "itu", "ya", "tidak", "apa", "mau", "suka", "sangat",
  "orang", "teman", "nama", "makan", "minum", "tidur", "air", "nasi", "kopi", "teh",
  "hari", "jam", "sekarang", "malam", "siang", "rumah", "kamar", "pintu", "jendela", "dapur",
  "buku", "jalan", "pasar", "bus", "kereta", "sekolah", "kantor", "beli", "uang", "barang", "makanan",
  "minuman", "enak", "bagus", "murah", "mahal", "ibu", "ayah", "kakak", "adik", "keluarga",
  "hujan", "panas", "dingin", "cerah", "cuaca", "mendung", "satu", "dua", "tiga", "empat",
  "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "berapa", "halo", "hai",
  "selamat pagi", "selamat malam", "terima kasih", "sama-sama", "maaf", "ayam", "ikan",
  "roti", "sate", "susu", "pesan", "tagihan", "siapa", "di mana", "pukul",
];

const rank = new Map(FREQUENCY.map((id, i) => [id, i + 1]));

const entries = text.split(/^  \{$/m).slice(1);
const already = new Set(
  entries.filter((e) => e.includes("frequency:")).map((e) => e.match(/id: "([^"]+)"/)?.[1]).filter(Boolean),
);

let out = [];
let currentId = null;
let inserted = 0;
let needLevel = false;
const insertedIds = new Set();

for (const line of lines) {
  out.push(line);
  const idMatch = line.match(/^    id: "([^"]+)",$/);
  if (idMatch) {
    currentId = idMatch[1];
    needLevel = rank.has(currentId) && !already.has(currentId);
    continue;
  }
  if (needLevel && currentId && line.startsWith("    level:")) {
    out.push(`    frequency: ${rank.get(currentId)},`);
    insertedIds.add(currentId);
    inserted++;
    needLevel = false;
  }
}

if (inserted !== rank.size) {
  const missing = FREQUENCY.filter((id) => !insertedIds.has(id));
  console.error("COVERAGE:", inserted, "of", rank.size, "missing:", missing);
  process.exit(1);
}

writeFileSync(file, out.join("\n"));
console.log(`inserted ${inserted} frequency fields`);
