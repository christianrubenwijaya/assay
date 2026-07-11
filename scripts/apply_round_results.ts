// Step 2: setelah kedua submission per pair dijudge (mis. lewat 2x run scripts/run_tournament.ts
// pakai seed yang sama dari round_pairs.json), gabungin hasilnya + apply ke rating store.
//
// Usage:
//   npx tsx scripts/apply_round_results.ts --pairs out/round_pairs.json \
//     --results out/_tournament/results.json --ratings data/ratings.json
//
// results.json: array RunState dari run_tournament.ts (punya field participant + score/ratable/flags).
// Kalau lo trigger match manual (bukan lewat run_tournament.ts), bikin file JSON sendiri
// dengan bentuk minimal: [{ "participant": "...", "score": N, "ratable": bool, "flags": [...] }]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname } from "node:path";
import { loadStore, saveStore } from "../src/elo/store.js";
import { applyMatchResult } from "../src/elo/apply.js";
import type { JudgeResult } from "../src/util.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

function toJudgeResult(r: any, brief: string): JudgeResult {
  return { participant: r.participant, brief_id: brief, division: "open", track: "competitive", score: r.score ?? 0, components: {}, checks: [], flags: r.flags ?? [], build_ok: true, smoke_ok: true, load_ms: 0, ratable: r.ratable ?? false };
}

function main() {
  const a: any = Object.fromEntries(process.argv.slice(2).reduce((acc: string[][], v, i, arr) => { if (v.startsWith("--")) acc.push([v.slice(2), arr[i + 1]]); return acc; }, []));
  if (!a.pairs || !a.results) { console.error("Wajib: --pairs out/round_pairs.json --results out/_tournament/results.json [--ratings data/ratings.json]"); process.exit(1); }
  const eloConfig = JSON.parse(readFileSync(resolve(ROOT, "config/elo.json"), "utf8"));
  const ratingsPath = a.ratings || resolve(ROOT, "data", "ratings.json");
  const store = loadStore(ratingsPath);
  const roundData = JSON.parse(readFileSync(a.pairs, "utf8"));
  const results: any[] = JSON.parse(readFileSync(a.results, "utf8"));
  const byParticipant = new Map(results.map(r => [r.participant, r]));

  for (const pair of roundData.pairs) {
    const rA = byParticipant.get(pair.a), rB = byParticipant.get(pair.b);
    if (!rA || !rB) { console.error(`  SKIP ${pair.a} vs ${pair.b} -- hasil judge gak lengkap (rA=${!!rA} rB=${!!rB})`); continue; }
    const res = applyMatchResult(store, pair.a, pair.b, toJudgeResult(rA, roundData.brief), toJudgeResult(rB, roundData.brief),
      { drawMarginPoints: eloConfig.draw_margin_points, initialRating: eloConfig.initial_rating, kTiers: eloConfig.k_tiers, brief: roundData.brief });
    console.log(`  ${pair.a} vs ${pair.b}: ${res.outcome} -- ${res.reason}`);
    console.log(`    ${pair.a}: ${res.a.before} -> ${res.a.after} (K=${res.a.k})`);
    console.log(`    ${pair.b}: ${res.b.before} -> ${res.b.after} (K=${res.b.k})`);
  }
  if (roundData.bye) console.log(`  BYE: ${roundData.bye} (gak ada perubahan rating)`);
  saveStore(ratingsPath, store);
  console.log(`\n[apply-round] rating store ditulis ke ${ratingsPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
