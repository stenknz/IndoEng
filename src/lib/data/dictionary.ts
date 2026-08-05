import { WORD_BANK } from "@/lib/data/words";

export interface DictionaryEntry {
  id: string;
  indonesian: string;
  english: string;
  alternatives?: string[];
  pronunciation?: string;
  wordClass?: string;
  example?: string;
  exampleEn?: string;
  synonyms?: string[];
  antonyms?: string[];
  formal?: string;
  casual?: string;
  expression?: string;
  related?: string[];
  note?: string;
}

// Rich entries for words already in the word bank (base fields come from the
// bank; these add word class, alternatives, register, synonyms and usage).
const ENRICH: Record<string, Partial<DictionaryEntry>> = {
  "terima kasih": {
    wordClass: "phrase",
    synonyms: ["makasih"],
    formal: "Terima kasih banyak",
    casual: "Makasih",
    expression: "Terima kasih banyak — thank you very much",
    note: "Formal: 'terima kasih'. Casual: 'makasih'. Reply with 'sama-sama'.",
  },
  maaf: {
    wordClass: "interjection",
    synonyms: ["minta maaf"],
    formal: "Maafkan saya",
    casual: "Maaf, ya",
    note: "'Maaf' = sorry. 'Maafkan saya' = forgive me (more formal).",
  },
  halo: {
    wordClass: "interjection",
    alternatives: ["hi", "hello (phone)"],
    casual: "Hai",
    formal: "Selamat pagi/siang/sore/malam",
    note: "Informal greeting. Use 'Selamat pagi' etc. with people you don't know well.",
  },
  "sama-sama": {
    wordClass: "phrase",
    alternatives: ["you're welcome", "likewise"],
    note: "Reply to 'terima kasih'. Can also mean 'the same'.",
  },
  suka: {
    wordClass: "verb",
    synonyms: ["gemar", "senang"],
    casual: "Suka banget — really like",
    expression: "Saya suka... — I like...",
    note: "'Suka' = to like (informal). 'Gemar' is a more formal synonym.",
  },
  mau: {
    wordClass: "verb",
    synonyms: ["ingin"],
    note: "'Mau' = want (everyday). 'Ingin' = want (slightly more formal/polite).",
  },
  sangat: {
    wordClass: "adverb",
    synonyms: ["banget"],
    casual: "banget (e.g. enak banget)",
    note: "'Sangat' = very (formal). 'Banget' = very (colloquial).",
  },
  enak: {
    wordClass: "adjective",
    synonyms: ["lezat", "nikmat"],
    casual: "Enak banget",
    note: "'Enak' = delicious, also comfortable/pleasant.",
  },
  tidak: {
    wordClass: "adverb",
    synonyms: ["nggak", "gak"],
    note: "'Tidak' negates verbs/adjectives: 'Saya tidak makan'. 'Bukan' negates nouns: 'Ini bukan nasi'.",
  },
  nasi: {
    wordClass: "noun",
    related: ["makanan", "ayam", "ikan"],
    expression: "Nasi goreng — fried rice",
    note: "'Nasi' = cooked rice. Rice in the field is 'padi'.",
  },
  kopi: {
    wordClass: "noun",
    expression: "Kopi susu — coffee with milk",
    note: "A common order: 'Kopi susu' (milk coffee) or 'kopi hitam' (black coffee).",
  },
  air: {
    wordClass: "noun",
    alternatives: ["water", "drink"],
    expression: "Air minum — drinking water",
    note: "'Air' = water, and in compounds 'air teh' = tea, 'air putih' = plain water.",
  },
  rumah: {
    wordClass: "noun",
    related: ["kamar", "dapur", "pintu"],
    expression: "Rumah sakit — hospital",
    note: "'Rumah' = house/home. 'Pulang' = to go home.",
  },
  jalan: {
    wordClass: "noun",
    alternatives: ["road", "street", "to walk"],
    related: ["bus", "kereta", "pasar"],
    expression: "Jalan-jalan — to take a stroll",
    note: "'Jalan' = road; reduplicated 'jalan-jalan' = to go for a walk.",
  },
  uang: {
    wordClass: "noun",
    expression: "Uang kembalian — (your) change",
    note: "Indonesian currency is the rupiah (Rp).",
  },
  buku: {
    wordClass: "noun",
    expression: "Buku tulis — notebook",
    note: "'Buku' = book. 'Buku tulis' = notebook.",
  },
  makan: {
    wordClass: "verb",
    related: ["nasi", "ayam", "ikan"],
    expression: "Sudah makan? — Have you eaten?",
    note: "A common greeting in Indonesia is 'Sudah makan?' (Have you eaten?).",
  },
  minum: {
    wordClass: "verb",
    related: ["air", "kopi", "teh", "susu"],
    expression: "Mau minum apa? — What would you like to drink?",
  },
  tidur: {
    wordClass: "verb",
    expression: "Selamat tidur — good night (sleep well)",
  },
  "selamat pagi": {
    wordClass: "phrase",
    formal: "Selamat pagi",
    note: "Greeting used from morning to ~11am. 'Selamat' + time of day.",
  },
  "selamat malam": {
    wordClass: "phrase",
    formal: "Selamat malam",
    note: "Greeting for evening/night.",
  },
};

// Extra high-frequency words/phrases beyond the word bank.
const EXTRA: DictionaryEntry[] = [
  { id: "apa kabar", indonesian: "apa kabar", english: "how are you", pronunciation: "AH-pah KAH-bar", wordClass: "phrase", example: "Apa kabar?", exampleEn: "How are you?", expression: "Kabar baik — I'm well", note: "Standard reply: 'Kabar baik' (good) or 'Baik-baik saja' (fine)." },
  { id: "sudah", indonesian: "sudah", english: "already, done", pronunciation: "SOO-dah", wordClass: "adverb", synonyms: ["selesai"], example: "Sudah makan?", exampleEn: "Have you eaten?", note: "'Sudah' = already; its opposite is 'belum' (not yet)." },
  { id: "belum", indonesian: "belum", english: "not yet", pronunciation: "buh-LOOM", wordClass: "adverb", example: "Belum, nanti saja.", exampleEn: "Not yet, later.", note: "Opposite of 'sudah'." },
  { id: "bisa", indonesian: "bisa", english: "can, able to", pronunciation: "BEE-sah", wordClass: "verb", synonyms: ["dapat"], example: "Bisa bicara bahasa Indonesia?", exampleEn: "Can you speak Indonesian?", note: "'Bisa' = can (ability). 'Boleh' = may (permission)." },
  { id: "boleh", indonesian: "boleh", english: "may, allowed", pronunciation: "BOH-leh", wordClass: "verb", example: "Boleh saya masuk?", exampleEn: "May I come in?", note: "Permission; 'bisa' is ability." },
  { id: "ingin", indonesian: "ingin", english: "to want, desire", pronunciation: "EEN-geen", wordClass: "verb", synonyms: ["mau"], example: "Saya ingin minum kopi.", exampleEn: "I want to drink coffee.", note: "More formal/polite than 'mau'." },
  { id: "harus", indonesian: "harus", english: "must, have to", pronunciation: "HAH-roos", wordClass: "verb", example: "Saya harus pergi.", exampleEn: "I have to go.", note: "Obligation. 'Tidak harus' = don't have to." },
  { id: "pergi", indonesian: "pergi", english: "to go", pronunciation: "puhr-GEE", wordClass: "verb", antonyms: ["pulang"], example: "Mau pergi ke mana?", exampleEn: "Where are you going?", note: "'Pergi' = to go (away). 'Pulang' = to go home." },
  { id: "pulang", indonesian: "pulang", english: "to go home", pronunciation: "POO-lahng", wordClass: "verb", example: "Saya pulang jam lima.", exampleEn: "I go home at five.", note: "Return home (not 'go' in general)." },
  { id: "datang", indonesian: "datang", english: "to come, arrive", pronunciation: "DAH-tahng", wordClass: "verb", example: "Kapan kamu datang?", exampleEn: "When do you arrive?", note: "'Datang' = come/arrive." },
  { id: "lihat", indonesian: "lihat", english: "to see, look", pronunciation: "LEE-haht", wordClass: "verb", synonyms: ["melihat"], example: "Lihat itu!", exampleEn: "Look at that!", note: "'Lihat' = see; 'Lihat-lihat' = to look around (window shopping)." },
  { id: "dengar", indonesian: "dengar", english: "to hear, listen", pronunciation: "DUHNG-ahr", wordClass: "verb", synonyms: ["mendengar", "dengarkan"], example: "Dengar baik-baik.", exampleEn: "Listen carefully.", note: "'Dengar' = to hear; 'Dengarkan' = listen (command)." },
  { id: "bicara", indonesian: "bicara", english: "to speak, talk", pronunciation: "bee-CHAH-rah", wordClass: "verb", synonyms: ["berbicara", "ngomong"], example: "Saya mau bicara dengan kamu.", exampleEn: "I want to talk with you.", note: "'Bicara' (colloquial) / 'berbicara' (formal)." },
  { id: "tanya", indonesian: "tanya", english: "to ask", pronunciation: "TAHN-yah", wordClass: "verb", synonyms: ["bertanya"], example: "Boleh tanya?", exampleEn: "May I ask?", note: "'Tanya' = ask; 'jawab' = answer." },
  { id: "jawab", indonesian: "jawab", english: "to answer", pronunciation: "JAH-wahb", wordClass: "verb", synonyms: ["menjawab"], example: "Jawab pertanyaan ini.", exampleEn: "Answer this question.", note: "'Jawab' = answer; 'tanya' = ask." },
  { id: "tahu", indonesian: "tahu", english: "to know", pronunciation: "TAH-hoo", wordClass: "verb", example: "Saya tidak tahu.", exampleEn: "I don't know.", note: "'Tahu' = to know (a fact). 'Kenal' = to know (a person)." },
  { id: "kenal", indonesian: "kenal", english: "to know (a person)", pronunciation: "kuh-NAHL", wordClass: "verb", example: "Saya kenal dia.", exampleEn: "I know him/her.", note: "'Kenal' = know someone; 'tahu' = know something." },
  { id: "paham", indonesian: "paham", english: "to understand", pronunciation: "PAH-hahm", wordClass: "verb", synonyms: ["mengerti"], example: "Saya paham.", exampleEn: "I understand.", note: "'Paham' = understand; 'mengerti' is a synonym." },
  { id: "sama", indonesian: "sama", english: "same, with", pronunciation: "SAH-mah", wordClass: "preposition/adjective", example: "Saya mau pergi sama kamu.", exampleEn: "I want to go with you.", note: "'Sama' = with (informal); 'dengan' = with (formal). Also 'the same'." },
  { id: "dengan", indonesian: "dengan", english: "with, by", pronunciation: "DUHNG-ahn", wordClass: "preposition", example: "Saya bicara dengan ibu.", exampleEn: "I talk with mother.", note: "Formal 'with'; casual is 'sama'." },
  { id: "untuk", indonesian: "untuk", english: "for", pronunciation: "OON-took", wordClass: "preposition", example: "Ini untuk kamu.", exampleEn: "This is for you." },
  { id: "dari", indonesian: "dari", english: "from", pronunciation: "DAH-ree", wordClass: "preposition", example: "Saya dari Indonesia.", exampleEn: "I'm from Indonesia.", note: "'Dari' = from; 'ke' = to." },
  { id: "ke", indonesian: "ke", english: "to (direction)", pronunciation: "kuh", wordClass: "preposition", example: "Saya mau pergi ke pasar.", exampleEn: "I want to go to the market.", note: "Direction: 'ke pasar' = to the market." },
  { id: "di", indonesian: "di", english: "in, at", pronunciation: "dee", wordClass: "preposition", example: "Saya di rumah.", exampleEn: "I'm at home.", note: "Location: 'di rumah' = at home." },
  { id: "juga", indonesian: "juga", english: "also, too", pronunciation: "JOO-gah", wordClass: "adverb", example: "Saya juga mau.", exampleEn: "I want too." },
  { id: "masih", indonesian: "masih", english: "still", pronunciation: "MAH-seeh", wordClass: "adverb", example: "Masih di sini?", exampleEn: "Still here?", note: "'Masih' = still; 'sudah' = already." },
  { id: "hanya", indonesian: "hanya", english: "only", pronunciation: "HAHN-yah", wordClass: "adverb", synonyms: ["cuma"], example: "Hanya satu.", exampleEn: "Only one.", note: "'Hanya' (formal) / 'cuma' (casual)." },
  { id: "semua", indonesian: "semua", english: "all, everything", pronunciation: "suh-MOO-ah", wordClass: "pronoun", example: "Semua sudah siap.", exampleEn: "Everything is ready." },
  { id: "baru", indonesian: "baru", english: "new, just", pronunciation: "BAH-roo", wordClass: "adjective/adverb", example: "Saya baru makan.", exampleEn: "I just ate.", note: "'Baru' = new; also 'just (recently)'." },
  { id: "lama", indonesian: "lama", english: "long (time), old", pronunciation: "LAH-mah", wordClass: "adjective", example: "Berapa lama?", exampleEn: "How long?", note: "'Lama' = long (duration); 'tua' = old (age)." },
  { id: "cepat", indonesian: "cepat", english: "fast, quick", pronunciation: "chuh-PAHT", wordClass: "adjective", antonyms: ["lambat"], example: "Cepat sekali!", exampleEn: "So fast!", note: "'Cepat' = fast; 'lambat' = slow." },
  { id: "lambat", indonesian: "lambat", english: "slow, late", pronunciation: "LAHM-baht", wordClass: "adjective", antonyms: ["cepat"], example: "Kereta ini lambat.", exampleEn: "This train is slow.", note: "'Lambat' = slow; also 'late'." },
  { id: "selamat datang", indonesian: "selamat datang", english: "welcome", pronunciation: "suh-LAH-maht DAH-tahng", wordClass: "phrase", example: "Selamat datang di rumah!", exampleEn: "Welcome home!", note: "Used to welcome someone." },
  { id: "tidak apa-apa", indonesian: "tidak apa-apa", english: "it's fine, no problem", pronunciation: "TEE-dahk AH-pah AH-pah", wordClass: "phrase", casual: "Nggak apa-apa", example: "Tidak apa-apa.", exampleEn: "It's fine.", note: "Reassurance; casual: 'nggak apa-apa'." },
  { id: "tolong", indonesian: "tolong", english: "please, help", pronunciation: "TOH-long", wordClass: "verb/interjection", example: "Tolong, satu kopi.", exampleEn: "One coffee, please.", note: "'Tolong' = please (asking) or help." },
  { id: "silakan", indonesian: "silakan", english: "please go ahead", pronunciation: "see-LAH-kahn", wordClass: "interjection", example: "Silakan masuk.", exampleEn: "Please come in.", note: "Polite invitation/permission." },
  { id: "dapat", indonesian: "dapat", english: "to get, to obtain", pronunciation: "DAH-paht", wordClass: "verb", synonyms: ["bisa"], example: "Saya dapat pesan kamu.", exampleEn: "I got your message.", note: "'Dapat' = get/receive; also 'can' in some regions." },
  { id: "melihat", indonesian: "melihat", english: "to see (formal)", pronunciation: "muh-LEE-haht", wordClass: "verb", synonyms: ["lihat"], example: "Saya melihat burung.", exampleEn: "I see a bird.", note: "Formal form of 'lihat'." },
  { id: "makanan", indonesian: "makanan", english: "food", pronunciation: "mah-KAH-nahn", wordClass: "noun", related: ["nasi", "ayam", "ikan"], example: "Makanan ini enak.", exampleEn: "This food is delicious.", note: "'Makanan' = food; 'minuman' = drinks." },
  { id: "harga", indonesian: "harga", english: "price", pronunciation: "HAHR-gah", wordClass: "noun", example: "Berapa harga ini?", exampleEn: "How much is this?", expression: "Berapa harganya? — How much is it?" },
  { id: "dulu", indonesian: "dulu", english: "before, earlier, first", pronunciation: "DOO-loo", wordClass: "adverb", example: "Saya dulu mau ke pasar.", exampleEn: "First I want to go to the market.", note: "'Dulu' = first/earlier; also 'sebentar dulu' = just a moment." },
  { id: "besok", indonesian: "besok", english: "tomorrow", pronunciation: "BEH-sohk", wordClass: "adverb", example: "Sampai besok!", exampleEn: "See you tomorrow!", note: "'Kemarin' = yesterday." },
  { id: "kemarin", indonesian: "kemarin", english: "yesterday", pronunciation: "kuh-MAH-reen", wordClass: "adverb", example: "Kemarin hujan.", exampleEn: "Yesterday it rained.", note: "'Kemarin' = yesterday; 'besok' = tomorrow." },
  { id: "hari ini", indonesian: "hari ini", english: "today", pronunciation: "HAH-ree EE-nee", wordClass: "phrase", example: "Hari ini panas.", exampleEn: "Today is hot.", note: "'Hari ini' = today; 'nanti' = later." },
  { id: "nanti", indonesian: "nanti", english: "later", pronunciation: "NAHN-tee", wordClass: "adverb", example: "Nanti saja.", exampleEn: "Later.", note: "Deferred/soon." },
  { id: "sini", indonesian: "sini", english: "here", pronunciation: "SEE-nee", wordClass: "adverb", example: "Mari ke sini.", exampleEn: "Come here.", note: "'Sini' = here; 'sana' = there; 'situ' = there (near you)." },
  { id: "sana", indonesian: "sana", english: "there", pronunciation: "SAH-nah", wordClass: "adverb", example: "Di sana ada pasar.", exampleEn: "There's a market there.", note: "'Sana' = there (far); 'sini' = here." },
  { id: "baik", indonesian: "baik", english: "good, kind, well", pronunciation: "BAH-eek", wordClass: "adjective", synonyms: ["bagus"], example: "Kabar baik.", exampleEn: "Good news / I'm well.", note: "'Baik' = good (character/state); 'bagus' = nice (quality)." },
  { id: "pandai", indonesian: "pandai", english: "clever, smart", pronunciation: "pahn-DYE", wordClass: "adjective", synonyms: ["pintar"], example: "Dia pandai sekali.", exampleEn: "He/she is very smart.", note: "'Pandai' / 'pintar' = smart." },
  { id: "cantik", indonesian: "cantik", english: "beautiful", pronunciation: "CHAHN-teek", wordClass: "adjective", example: "Pemandangan ini cantik.", exampleEn: "This view is beautiful.", note: "'Cantik' = beautiful (women/scenery); 'tampan' = handsome (men)." },
  { id: "tampan", indonesian: "tampan", english: "handsome", pronunciation: "TAHM-pahn", wordClass: "adjective", example: "Dia tampan.", exampleEn: "He is handsome.", note: "Male counterpart of 'cantik'." },
];

function buildDictionary(): DictionaryEntry[] {
  const bank: DictionaryEntry[] = WORD_BANK.map((w) => {
    const rich = ENRICH[w.id] ?? {};
    return {
      id: w.id,
      indonesian: w.indonesian,
      english: w.english,
      pronunciation: rich.pronunciation ?? w.pronunciation,
      wordClass: rich.wordClass ?? inferWordClass(w.category),
      example: rich.example ?? w.example,
      exampleEn: rich.exampleEn ?? w.exampleTranslation,
      related: rich.related ?? relatedFromCategory(w.category),
      ...rich,
    };
  });
  return bank.concat(EXTRA);
}

function inferWordClass(category: string): string {
  switch (category) {
    case "food":
    case "drinks":
    case "house":
    case "places":
    case "family":
    case "people":
    case "time":
    case "weather":
      return "noun";
    case "numbers":
    case "questions":
    case "yesno":
    case "greetings":
      return "phrase";
    default:
      return "word";
  }
}

function relatedFromCategory(category: string): string[] | undefined {
  const map: Record<string, string[]> = {
    food: ["makan", "enak"],
    drinks: ["minum"],
    family: ["keluarga"],
    house: ["rumah"],
    places: ["jalan"],
    weather: ["hari"],
  };
  return map[category];
}

export const DICTIONARY: DictionaryEntry[] = buildDictionary();

export function searchDictionary(query: string, limit = 12): DictionaryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches: { e: DictionaryEntry; p: number }[] = [];
  const seen = new Set<string>();
  for (const e of DICTIONARY) {
    if (seen.has(e.id)) continue;
    const hay = [
      e.indonesian,
      e.english,
      e.expression ?? "",
      ...(e.alternatives ?? []),
      ...(e.synonyms ?? []),
    ]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) continue;
    seen.add(e.id);
    const id = e.indonesian.toLowerCase();
    const en = e.english.toLowerCase();
    let p: number;
    if (id === q || en === q) p = 0;
    else if (id.startsWith(q)) p = 1;
    else if (id.includes(q)) p = 2;
    else if (en.includes(q)) p = 3;
    else p = 4;
    matches.push({ e, p });
  }
  matches.sort((a, b) => a.p - b.p);
  return matches.slice(0, limit).map((m) => m.e);
}
