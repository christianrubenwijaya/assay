import type { JudgeResult } from "../util.js";
import { resolveMatch } from "./match.js";
import { expectedScore, kFactor, updateRating, type KTier } from "./rating.js";
import { getOrCreate, type RatingStore } from "./store.js";

export interface ApplyOpts { drawMarginPoints: number; initialRating: number; kTiers: KTier[]; brief: string; }

export interface ApplyResult {
  outcome: string; reason: string;
  a: { id: string; before: number; after: number; k: number };
  b: { id: string; before: number; after: number; k: number };
}

// Update store IN-PLACE (caller nulis ulang lewat saveStore()). Return delta buat logging.
export function applyMatchResult(
  store: RatingStore, idA: string, idB: string, resultA: JudgeResult, resultB: JudgeResult, opts: ApplyOpts
): ApplyResult {
  const pa = getOrCreate(store, idA, opts.initialRating);
  const pb = getOrCreate(store, idB, opts.initialRating);
  const res = resolveMatch(resultA, resultB, opts.drawMarginPoints);
  const ts = new Date().toISOString();

  if (res.outcome === "double_forfeit") {
    // SENGAJA nol perubahan rating -- keduanya not-ratable = nol informasi soal skill
    // relatif, treat sebagai draw formula bakal SALAH (masih geser rating berdasarkan
    // gap rating awal, padahal gak ada match yang valid beneran terjadi).
    pa.games++; pb.games++; pa.draws++; pb.draws++;
    pa.history.push({ ts, opponent: idB, brief: opts.brief, outcome: "double_forfeit", ratingBefore: pa.rating, ratingAfter: pa.rating, k: 0 });
    pb.history.push({ ts, opponent: idA, brief: opts.brief, outcome: "double_forfeit", ratingBefore: pb.rating, ratingAfter: pb.rating, k: 0 });
    return { outcome: res.outcome, reason: res.reason, a: { id: idA, before: pa.rating, after: pa.rating, k: 0 }, b: { id: idB, before: pb.rating, after: pb.rating, k: 0 } };
  }

  const kA = kFactor(pa.games, opts.kTiers), kB = kFactor(pb.games, opts.kTiers);
  const beforeA = pa.rating, beforeB = pb.rating;
  const afterA = updateRating(beforeA, beforeB, res.sA, kA);
  const afterB = updateRating(beforeB, beforeA, res.sB, kB);

  pa.rating = afterA; pb.rating = afterB; pa.games++; pb.games++;
  const outA = res.sA === 1 ? "win" : res.sA === 0 ? "loss" : "draw";
  const outB = res.sB === 1 ? "win" : res.sB === 0 ? "loss" : "draw";
  if (outA === "win") pa.wins++; else if (outA === "loss") pa.losses++; else pa.draws++;
  if (outB === "win") pb.wins++; else if (outB === "loss") pb.losses++; else pb.draws++;
  pa.history.push({ ts, opponent: idB, brief: opts.brief, outcome: outA, ratingBefore: beforeA, ratingAfter: afterA, k: kA });
  pb.history.push({ ts, opponent: idA, brief: opts.brief, outcome: outB, ratingBefore: beforeB, ratingAfter: afterB, k: kB });

  return { outcome: res.outcome, reason: res.reason, a: { id: idA, before: beforeA, after: afterA, k: kA }, b: { id: idB, before: beforeB, after: afterB, k: kB } };
}
