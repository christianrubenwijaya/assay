import { execSync } from "node:child_process";

export type Track = "casual" | "competitive" | "final";
export type Division = "standard" | "open";

export interface CheckResult { id: string; label: string; seed: boolean; pass: boolean; detail: string; }
export interface JudgeResult {
  participant: string; brief_id: string; division: Division; track: Track;
  score: number; components: Record<string, number>;
  checks: CheckResult[]; flags: string[];
  build_ok: boolean; smoke_ok: boolean; load_ms: number;
}

export function sh(cmd: string, cwd: string, timeoutMs = 120000): { ok: boolean; out: string } {
  try {
    const out = execSync(cmd, { cwd, timeout: timeoutMs, stdio: "pipe", encoding: "utf8" });
    return { ok: true, out };
  } catch (e: any) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") + (e.message || "") };
  }
}
export const log = (...a: unknown[]) => console.log("[assay]", ...a);
