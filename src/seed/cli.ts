// CLI: generate seed assignment buat 1 brief + 1 salt event, dari daftar participant ID.
// Dipake host SEBELUM/PAS event mulai (bukan diumumin ke peserta sebelumnya -- salt
// yang bikin ini gak predictable, lihat komentar src/seed/assign.ts).
//
// Usage:
//   npm run assign-seeds -- --brief 01-endless-runner --participants participants.txt --salt "rahasia-jam1" --out out/seeds.json
//
// participants.txt: 1 participant ID per baris (mis. GitHub username peserta).
// out/seeds.json: { "<participant_id>": { ...seed sesuai brief... }, ... }
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadSpace, cardinality } from "./space.js";
import { assignSeeds } from "./assign.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

function main() {
  const a: any = Object.fromEntries(process.argv.slice(2).reduce((acc: string[][], v, i, arr) => { if (v.startsWith("--")) acc.push([v.slice(2), arr[i + 1]]); return acc; }, []));
  if (!a.brief || !a.participants || !a.salt) {
    console.error("Wajib: --brief <id> --participants <file.txt> --salt <string> [--out out/seeds.json]");
    process.exit(1);
  }
  const space = loadSpace(ROOT);
  const cap = cardinality(a.brief, space);
  const participantIds = readFileSync(a.participants, "utf8").split("\n").map(s => s.trim()).filter(Boolean);
  console.log(`[assign-seeds] brief=${a.brief} cardinality=${cap} participants=${participantIds.length}`);
  if (participantIds.length > cap * 0.5) {
    console.warn(`[assign-seeds] WARNING: ${participantIds.length} peserta udah > 50% cardinality (${cap}). Masih aman (collision-free dijamin lewat open-addressing), tapi mepet -- pertimbangin perbesar config/seed_space.json buat event berikutnya.`);
  }
  const assigned = assignSeeds(participantIds, a.brief, a.salt, space);
  const out: Record<string, any> = {};
  for (const [pid, seed] of assigned) out[pid] = seed;
  const outPath = a.out || resolve(ROOT, "out", "seeds.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`[assign-seeds] ditulis ke ${outPath}. Salt dipake: "${a.salt}" -- SIMPAN ini kalau perlu re-derive/audit nanti, tapi JANGAN diumumin ke peserta sebelum window ditutup.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
