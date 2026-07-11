// Step 1 dari 1 ronde competitive: pairing + assign 1 seed SAMA per pair (fairness --
// 2 peserta yang lagi lawan HARUS dapet tugas yang sama persis buat dibandingin adil).
//
// Usage:
//   npx tsx scripts/run_elo_round.ts --brief 01-endless-runner --roster out/roster.json \
//     --ratings data/ratings.json --salt "rahasia-round1" --out out/round_pairs.json
//
// roster.json: [{ "participant": "alice", "repo": "..." }, ...] (sama format run_tournament.ts)
// Output out/round_pairs.json: { pairs: [{a,b,seed,repoA,repoB}], bye }
// Lanjut: pakai output ini buat trigger 2x run_tournament.ts (atau extend manual) per
// pair dengan seed yang SAMA, lalu `npx tsx scripts/apply_round_results.ts` buat update
// data/ratings.json dari hasilnya.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadSpace, cardinality, seedAt } from "../src/seed/space.js";
import { loadStore, getOrCreate } from "../src/elo/store.js";
import { pairRound } from "../src/elo/pairing.js";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

function main() {
  const a: any = Object.fromEntries(process.argv.slice(2).reduce((acc: string[][], v, i, arr) => { if (v.startsWith("--")) acc.push([v.slice(2), arr[i + 1]]); return acc; }, []));
  if (!a.brief || !a.roster || !a.salt) { console.error("Wajib: --brief --roster --salt [--ratings data/ratings.json] [--out out/round_pairs.json]"); process.exit(1); }
  const eloConfig = JSON.parse(readFileSync(resolve(ROOT, "config/elo.json"), "utf8"));
  const ratingsPath = a.ratings || resolve(ROOT, "data", "ratings.json");
  const store = loadStore(ratingsPath);
  const rosterList: { participant: string; repo: string }[] = JSON.parse(readFileSync(a.roster, "utf8"));
  const players = rosterList.map(r => getOrCreate(store, r.participant, eloConfig.initial_rating));

  const playedPairs = new Set<string>();
  for (const p of players) for (const h of p.history) playedPairs.add([p.id, h.opponent].sort().join("::"));

  const { pairs, bye } = pairRound(players, playedPairs);
  const space = loadSpace(ROOT);
  const cap = cardinality(a.brief, space);
  const repoOf = new Map(rosterList.map(r => [r.participant, r.repo]));

  const outPairs = pairs.map(p => {
    const idx = (() => { const h = createHash("sha256").update(`${p.a}|${p.b}|${a.salt}|${a.brief}`).digest(); let n = 0; for (let i = 0; i < 6; i++) n = n * 256 + h[i]; return n % cap; })();
    return { a: p.a, b: p.b, repoA: repoOf.get(p.a), repoB: repoOf.get(p.b), ratingGap: p.ratingGap, seed: seedAt(a.brief, space, idx) };
  });

  const out = { brief: a.brief, pairs: outPairs, bye };
  const outPath = a.out || resolve(ROOT, "out", "round_pairs.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`[elo-round] ${outPairs.length} pair, bye=${bye ?? "-"}. Ditulis ke ${outPath}`);
  outPairs.forEach(p => console.log(`  ${p.a} vs ${p.b} (gap=${p.ratingGap}) seed=${JSON.stringify(p.seed)}`));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
