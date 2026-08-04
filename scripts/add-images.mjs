import { readFileSync, writeFileSync } from "node:fs";

const file = "src/lib/data/words.ts";
const text = readFileSync(file, "utf8");
const lines = text.split("\n");

const IMAGES = {
  orang: "people",
  teman: "people",
  ibu: "family",
  ayah: "family",
  keluarga: "family",
  kakak: "family",
  adik: "family",
  makan: "actions",
  minum: "actions",
  tidur: "actions",
  nasi: "food",
  makanan: "food",
  ayam: "food",
  ikan: "food",
  roti: "food",
  sate: "food",
  air: "drinks",
  kopi: "drinks",
  teh: "drinks",
  susu: "drinks",
  minuman: "drinks",
  rumah: "house",
  pintu: "house",
  kamar: "house",
  buku: "house",
  jendela: "house",
  dapur: "house",
  jalan: "places",
  bus: "places",
  kereta: "places",
  kantor: "places",
  sekolah: "places",
  pasar: "places",
  jam: "time",
  malam: "time",
  siang: "time",
  panas: "weather",
  dingin: "weather",
  hujan: "weather",
  cerah: "weather",
  cuaca: "weather",
  mendung: "weather",
  beli: "shopping",
  uang: "shopping",
  barang: "shopping",
  pesan: "restaurant",
  tagihan: "restaurant",
};

let out = [];
let currentId = null;
let inserted = new Set();
let insertNextCategory = false;

for (const line of lines) {
  out.push(line);
  const idMatch = line.match(/^    id: "([^"]+)",$/);
  if (idMatch) {
    currentId = idMatch[1];
    insertNextCategory = currentId in IMAGES && !inserted.has(currentId);
    continue;
  }
  if (insertNextCategory && currentId && line.includes(`category: "${IMAGES[currentId]}",`)) {
    const indent = line.match(/^(\s*)/)[1];
    out.push(`${indent}image: "/images/${IMAGES[currentId]}/${currentId}.jpg",`);
    inserted.add(currentId);
    insertNextCategory = false;
  }
}

writeFileSync(file, out.join("\n"));
console.log(`inserted ${inserted.size} image fields`);
const missing = Object.keys(IMAGES).filter((id) => !inserted.has(id));
if (missing.length) console.error("MISSING:", missing);
