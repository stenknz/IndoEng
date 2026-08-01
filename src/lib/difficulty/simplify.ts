const LADDER: Array<[RegExp, string]> = [
  [/Apa yang biasanya kamu lakukan/, "Kamu kerja"],
  [/setelah pulang kerja/, ""],
  [/Apa yang kamu/, "Kamu"],
  [/apakah kamu/, "kamu"],
  [/yang paling/, ""],
  [/bagaimana cara/, "cara"],
];

export function simplifyUtterance(sentence: string): string {
  let out = sentence;
  for (const [re, replacement] of LADDER) {
    out = out.replace(re, replacement).trim();
  }
  out = out.replace(/\s+/g, " ");
  if (out.length > 0 && out[0] === out[0].toLowerCase()) {
    out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}
