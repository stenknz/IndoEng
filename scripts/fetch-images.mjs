import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CATEGORIES = {
  orang: "people", teman: "people", ibu: "family", ayah: "family", keluarga: "family",
  kakak: "family", adik: "family", makan: "actions", minum: "actions", tidur: "actions",
  nasi: "food", makanan: "food", ayam: "food", ikan: "food", roti: "food", sate: "food",
  air: "drinks", kopi: "drinks", teh: "drinks", susu: "drinks", minuman: "drinks",
  rumah: "house", pintu: "house", kamar: "house", buku: "house", jendela: "house", dapur: "house",
  jalan: "places", bus: "places", kereta: "places", kantor: "places", sekolah: "places", pasar: "places",
  jam: "time", malam: "time", siang: "time",
  panas: "weather", dingin: "weather", hujan: "weather", cerah: "weather", cuaca: "weather", mendung: "weather",
  beli: "shopping", uang: "shopping", barang: "shopping",
  pesan: "restaurant", tagihan: "restaurant",
};

const QUERIES = {
  orang: "portrait of a man",
  teman: "two friends",
  ibu: "mother holding baby",
  ayah: "father with child",
  keluarga: "happy family",
  kakak: "two brothers",
  adik: "two children playing",
  makan: "man eating rice",
  minum: "woman drinking water",
  tidur: "sleeping child",
  nasi: "nasi rice indonesian",
  makanan: "food spread table",
  ayam: "ayam goreng chicken",
  ikan: "ikan fish dish",
  roti: "roti bread",
  sate: "sate satay",
  air: "glass of water",
  kopi: "kopi coffee cup",
  teh: "cup of tea",
  susu: "glass of milk",
  minuman: "beverage drink glass",
  rumah: "rumah gadang",
  pintu: "wooden door",
  kamar: "modern bedroom interior",
  buku: "open book",
  jendela: "window daylight",
  dapur: "modern kitchen interior",
  jalan: "street road town",
  bus: "city bus",
  kereta: "train railway locomotive",
  kantor: "office building",
  sekolah: "school building",
  pasar: "pasar market indonesia",
  jam: "wall clock",
  malam: "night city skyline",
  siang: "midday sun",
  panas: "desert landscape dunes",
  dingin: "snow winter landscape",
  hujan: "rain window drops",
  cerah: "sunny sky blue",
  cuaca: "sky clouds weather",
  mendung: "overcast cloudy sky",
  beli: "shopping buying store",
  uang: "rupiah indonesian money",
  barang: "supermarket products shelf",
  pesan: "restaurant menu ordering",
  tagihan: "restaurant receipt bill",
};

const PINNED_TITLES = {
  tidur: "File:A child sleeping.jpg",
};

const BAD_TITLE =
  /\.(svg|pdf|png|gif|tiff?|webp)$|logo|emblem|pictogram|icon|diagram|drawing|painting|sketch|engraving|etching|illustration|sculpture|statue|bust|watercolor|watercolour|chromolith|poster|art project|museum|daguerreotype|pinhead|yale|british art|study of|chamber|obituary|newspaper|clipping|scan|manuscript|naked|nude|nudity|cartoon|lithograph|oil on canvas|sailor|male genitals|wga|web gallery/i;

const EXCLUDE = {
  tidur: /cat|dog|kitten|puppy|bunny|rabbit|horse|bird/i,
  adik: /war|soldier|refugee|vintage|british/i,
};

const FORCE = new Set(["tidur"]);

const API = "https://commons.wikimedia.org/w/api.php";
const HEADERS = {
  "User-Agent": "KakTutorApp/1.0 (educational language app; contact: local dev)",
};

async function api(url) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 429) {
      const wait = 5000 * attempt + Math.random() * 2000;
      console.log(`  429 -> retrying in ${Math.round(wait / 1000)}s (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }
  throw new Error(`HTTP 429 persisted for ${url}`);
}

async function download(url) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 429) {
      const wait = 5000 * attempt + Math.random() * 2000;
      console.log(`  429 -> retrying in ${Math.round(wait / 1000)}s (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`download ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`download 429 persisted for ${url}`);
}

function licenseOk(meta) {
  const short = meta?.LicenseShortName?.value ?? "";
  return /(CC|public domain|PD)/i.test(short);
}

function score(title, query) {
  const words = query.toLowerCase().split(/\s+/);
  let s = 0;
  for (const w of words) {
    if (w.length >= 3 && title.toLowerCase().includes(w)) s += 1;
  }
  return s;
}

async function bestMatch(word, query) {
  const pinned = PINNED_TITLES[word];
  const search = pinned
    ? `${API}?action=query&format=json&titles=${encodeURIComponent(pinned)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800`
    : `${API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800`;
  const data = await api(search);
  const pages = data?.query?.pages ?? {};
  const exclude = EXCLUDE[word];
  const candidates = Object.values(pages)
    .filter((p) => p.imageinfo?.[0]?.thumburl)
    .map((p) => {
      const ii = p.imageinfo[0];
      const meta = ii.extmetadata ?? {};
      return {
        title: p.title,
        thumburl: ii.thumburl,
        page: ii.descriptionurl,
        license: meta.LicenseShortName?.value ?? "?",
        author: (meta.Artist?.value ?? "?").replace(/<[^>]+>/g, "").trim(),
        ok: licenseOk(meta) && !BAD_TITLE.test(p.title) && (!exclude || !exclude.test(p.title)),
      };
    })
    .sort((a, b) => b.ok - a.ok || score(b.title, query) - score(a.title, query));
  return candidates;
}

const attributionsPath = join(root, "public", "images", "attributions.json");
const existing = existsSync(attributionsPath) ? JSON.parse(readFileSync(attributionsPath, "utf8")) : [];
const attributions = existing.filter((a) => a?.word);
const usedFiles = new Set(attributions.map((a) => a.commons));
const failures = [];

for (const [word, query] of Object.entries(QUERIES)) {
  const dirByCategory = join(root, "public", "images", CATEGORIES[word]);
  const outJpg = join(dirByCategory, `${word}.jpg`);
  if (!FORCE.has(word) && existsSync(outJpg)) {
    console.log(`skip ${word} (exists)`);
    continue;
  }
  await new Promise((r) => setTimeout(r, 1500));
  try {
  const candidates = await bestMatch(word, query);
  const pinned = PINNED_TITLES[word];
  const pick = pinned
    ? candidates.find((c) => c.title === pinned) ?? candidates.find((c) => c.ok && !usedFiles.has(c.title))
    : candidates.find((c) => c.ok && !usedFiles.has(c.title));
    if (!pick) {
      failures.push({ word, reason: "no acceptable licensed match", top: candidates.slice(0, 3) });
      continue;
    }
    usedFiles.add(pick.title);
    mkdirSync(dirByCategory, { recursive: true });
    const tmp = join(root, "public", "images", ".tmp", `${word}.bin`);
    mkdirSync(join(root, "public", "images", ".tmp"), { recursive: true });

    writeFileSync(tmp, await download(pick.thumburl));
    execFileSync("sips", ["-Z", "800", "-s", "format", "jpeg", tmp, "--out", outJpg], { stdio: "ignore" });
    const info = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", outJpg]).toString();
    const w = /pixelWidth: (\d+)/.exec(info)?.[1];
    const h = /pixelHeight: (\d+)/.exec(info)?.[1];
    if (!w || !h || Number(w) < 200 || Number(h) < 150) {
      throw new Error(`bad dimensions ${w}x${h}`);
    }
    attributions.push({ word, file: `/images/${CATEGORIES[word]}/${word}.jpg`, commons: pick.title, page: pick.page, author: pick.author, license: pick.license, size: `${w}x${h}` });
    console.log(`ok ${word}: ${pick.title} (${pick.license}) ${w}x${h}`);
  } catch (e) {
    failures.push({ word, reason: String(e.message) });
  }
}

const byWord = new Map();
for (const a of attributions) byWord.set(a.word, a);
const final = [...byWord.values()].sort((a, b) => a.word.localeCompare(b.word));

writeFileSync(join(root, "public", "images", "attributions.json"), JSON.stringify(final, null, 2) + "\n");
writeFileSync(join(root, "public", "images", "fetch-log.json"), JSON.stringify({ failures }, null, 2) + "\n");
console.log(`\nDONE: ${final.length} images, ${failures.length} failures`);
for (const f of failures) console.log("FAIL:", JSON.stringify(f));
