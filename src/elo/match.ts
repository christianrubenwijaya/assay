// Resolusi 1 match competitive: 2 peserta, SAMA brief + SAMA seed (fairness -- beda
// seed = beda tugas, gak bisa dibandingin adil), masing2 hasil judgeSubmission() harness.
// TIDAK ada human judge di sini -- murni skor harness vs skor harness.
import type { JudgeResult } from "../util.js";

export type MatchOutcome = "A" | "B" | "draw" | "double_forfeit";
export interface MatchResolution { outcome: MatchOutcome; sA: number; sB: number; reason: string; }

export function resolveMatch(a: JudgeResult, b: JudgeResult, drawMarginPoints: number): MatchResolution {
  const aOk = a.ratable, bOk = b.ratable;

  // build-fail / cheat-flag (ratable=false) otomatis kalah lawan yang ratable --
  // ini SENGAJA, bukan cuma "skor rendah": submission gak sah gak boleh menang match
  // apapun skornya, walau harness numeriknya kebetulan tinggi.
  if (!aOk && !bOk) return { outcome: "double_forfeit", sA: 0.5, sB: 0.5, reason: "keduanya not-ratable (build fail / flagged) -- NOL rating change, bukan draw normal, lihat applyMatchResult()" };
  if (!aOk && bOk) return { outcome: "B", sA: 0, sB: 1, reason: `A not-ratable (${a.flags.join(",") || "build fail"}), B menang otomatis` };
  if (aOk && !bOk) return { outcome: "A", sA: 1, sB: 0, reason: `B not-ratable (${b.flags.join(",") || "build fail"}), A menang otomatis` };

  const diff = a.score - b.score;
  if (Math.abs(diff) <= drawMarginPoints) return { outcome: "draw", sA: 0.5, sB: 0.5, reason: `selisih skor ${Math.abs(diff)} <= draw margin ${drawMarginPoints}` };
  if (diff > 0) return { outcome: "A", sA: 1, sB: 0, reason: `A menang skor (${a.score} vs ${b.score})` };
  return { outcome: "B", sA: 0, sB: 1, reason: `B menang skor (${b.score} vs ${a.score})` };
}
