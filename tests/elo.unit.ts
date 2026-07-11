// Unit test murni utk src/elo/* -- TANPA browser.
import { expectedScore, kFactor, updateRating } from "../src/elo/rating.js";
import { resolveMatch } from "../src/elo/match.js";
import { applyMatchResult } from "../src/elo/apply.js";
import { pairRound } from "../src/elo/pairing.js";
import { tierFor } from "../src/elo/tiers.js";
import type { RatingStore, PlayerRecord } from "../src/elo/store.js";
import type { JudgeResult } from "../src/util.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const eloConfig = JSON.parse(readFileSync(resolve(ROOT, "config/elo.json"), "utf8"));

let failures = 0;
function expect(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { failures++; console.error(`  FAIL ${msg}`); }
}

function mkResult(score: number, ratable: boolean, flags: string[] = []): JudgeResult {
  return { participant: "x", brief_id: "01-endless-runner", division: "open", track: "competitive", score, components: {}, checks: [], flags, build_ok: true, smoke_ok: true, load_ms: 0, ratable };
}

console.log("[unit] expectedScore simetris -- E(A vs B) + E(B vs A) === 1");
expect(Math.abs(expectedScore(1200, 1000) + expectedScore(1000, 1200) - 1) < 1e-9, "E_A + E_B == 1");
expect(Math.abs(expectedScore(1000, 1000) - 0.5) < 1e-9, "rating sama -> E == 0.5");

console.log("[unit] kFactor tiering sesuai config/elo.json");
expect(kFactor(0, eloConfig.k_tiers) === 40, "games=0 -> K=40 (provisional)");
expect(kFactor(4, eloConfig.k_tiers) === 40, "games=4 -> masih K=40");
expect(kFactor(5, eloConfig.k_tiers) === 24, "games=5 -> K=24 (established)");
expect(kFactor(20, eloConfig.k_tiers) === 12, "games=20 -> K=12 (veteran)");
expect(kFactor(1000, eloConfig.k_tiers) === 12, "games besar -> tetep K=12 (tier terakhir)");

console.log("[unit] updateRating -- menang lawan rating sama harus naik +K/2 (E=0.5)");
expect(updateRating(1000, 1000, 1, 40) === 1020, `1000 menang K=40 -> 1020 (dapat ${updateRating(1000, 1000, 1, 40)})`);
expect(updateRating(1000, 1000, 0, 40) === 980, `1000 kalah K=40 -> 980 (dapat ${updateRating(1000, 1000, 0, 40)})`);

console.log("[unit] resolveMatch -- draw margin");
const rDraw = resolveMatch(mkResult(80, true), mkResult(82, true), 3);
expect(rDraw.outcome === "draw", `selisih 2 <= margin 3 -> draw (dapat ${rDraw.outcome})`);
const rWin = resolveMatch(mkResult(80, true), mkResult(70, true), 3);
expect(rWin.outcome === "A", `selisih 10 > margin -> A menang (dapat ${rWin.outcome})`);

console.log("[unit] resolveMatch -- not-ratable OTOMATIS kalah walau skor numerik lebih tinggi (anti-cheat)");
const rCheat = resolveMatch(mkResult(95, false, ["SEED_MISMATCH(prebuilt?)"]), mkResult(60, true), 3);
expect(rCheat.outcome === "B", `A skor 95 tapi not-ratable(cheat) -> B(60, ratable) tetap MENANG (dapat ${rCheat.outcome})`);

console.log("[unit] resolveMatch -- double forfeit kalau keduanya not-ratable");
const rBoth = resolveMatch(mkResult(0, false, ["BUILD_FAIL"]), mkResult(0, false, ["BUILD_FAIL"]), 3);
expect(rBoth.outcome === "double_forfeit", `keduanya build fail -> double_forfeit (dapat ${rBoth.outcome})`);

console.log("[unit] applyMatchResult -- double forfeit HARUS nol perubahan rating (bukan draw formula biasa)");
const store: RatingStore = {};
const opts = { drawMarginPoints: eloConfig.draw_margin_points, initialRating: eloConfig.initial_rating, kTiers: eloConfig.k_tiers, brief: "01-endless-runner" };
const dfRes = applyMatchResult(store, "p1", "p2", mkResult(0, false), mkResult(0, false), opts);
expect(dfRes.a.before === dfRes.a.after && dfRes.b.before === dfRes.b.after, `double forfeit -> rating gak berubah (before=${dfRes.a.before} after=${dfRes.a.after})`);
expect(store.p1.games === 1 && store.p2.games === 1, "double forfeit tetep kehitung 1 game (buat K-tier progression)");

console.log("[unit] applyMatchResult -- zero-sum check pas K sama (rating sama, games sama)");
const store2: RatingStore = {};
const zsRes = applyMatchResult(store2, "a", "b", mkResult(90, true), mkResult(70, true), opts);
const deltaA = zsRes.a.after - zsRes.a.before, deltaB = zsRes.b.after - zsRes.b.before;
expect(deltaA === -deltaB, `K sama & rating awal sama -> zero-sum (deltaA=${deltaA} deltaB=${deltaB})`);
expect(deltaA > 0 && deltaB < 0, "yang menang naik, yang kalah turun");

console.log("[unit] applyMatchResult -- cheater KALAH rating walau skor numerik lebih tinggi (INI YANG DITANYA Ben)");
const store3: RatingStore = {};
const cheatRes = applyMatchResult(store3, "cheater", "honest", mkResult(95, false, ["SEED_MISMATCH(prebuilt?)"]), mkResult(60, true), opts);
expect(cheatRes.a.after < cheatRes.a.before, `cheater(skor 95 tapi flagged) rating TURUN (before=${cheatRes.a.before} after=${cheatRes.a.after})`);
expect(cheatRes.b.after > cheatRes.b.before, `honest(skor 60, ratable) rating NAIK (before=${cheatRes.b.before} after=${cheatRes.b.after})`);

console.log("[unit] pairRound -- ganjil peserta -> 1 BYE, sisanya kepasang");
function mkPlayer(id: string, rating: number): PlayerRecord { return { id, rating, games: 0, wins: 0, losses: 0, draws: 0, history: [] }; }
const players5 = [mkPlayer("a", 1000), mkPlayer("b", 1050), mkPlayer("c", 950), mkPlayer("d", 1100), mkPlayer("e", 900)];
const round1 = pairRound(players5);
expect(round1.pairs.length === 2, `5 peserta -> 2 pair + 1 bye (dapat ${round1.pairs.length} pair)`);
expect(round1.bye !== null, `ada 1 bye (dapat ${round1.bye})`);

console.log("[unit] pairRound -- genap peserta -> semua kepasang, gak ada bye");
const players4 = [mkPlayer("a", 1000), mkPlayer("b", 1050), mkPlayer("c", 950), mkPlayer("d", 1100)];
const round2 = pairRound(players4);
expect(round2.pairs.length === 2 && round2.bye === null, `4 peserta -> 2 pair, 0 bye (dapat ${round2.pairs.length} pair, bye=${round2.bye})`);

console.log("[unit] pairRound -- hindari rematch kalau ada opsi lain");
const playedPairs = new Set(["a::b"]);
const round3 = pairRound(players4, playedPairs);
const hasAB = round3.pairs.some(p => (p.a === "a" && p.b === "b") || (p.a === "b" && p.b === "a"));
expect(!hasAB, `a vs b udah pernah main -> dihindari kalau ada kandidat lain (pairs=${JSON.stringify(round3.pairs)})`);

console.log("[unit] tierFor -- rating rendah = Perunggu (cuma brief 01, brief lain BELUM tervalidasi)");
const t0 = tierFor(1000, eloConfig.rank_tiers);
expect(t0.name === "Perunggu", `rating 1000 -> Perunggu (dapat ${t0.name})`);
expect(JSON.stringify(t0.briefs) === JSON.stringify(["01-endless-runner"]), `Perunggu cuma brief 01 (dapat ${JSON.stringify(t0.briefs)})`);
const t1 = tierFor(1400, eloConfig.rank_tiers);
expect(t1.name === "Platina", `rating 1400 -> Platina (dapat ${t1.name})`);

if (failures > 0) { console.error(`\n[unit] ${failures} assertion GAGAL.`); process.exit(1); }
console.log("\n[unit] semua assertion ELO lulus.");
