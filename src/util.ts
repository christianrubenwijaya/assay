import { execSync } from "node:child_process";

export type Track = "casual" | "competitive" | "final";
export type Division = "standard" | "open";

export interface CheckResult { id: string; label: string; seed: boolean; pass: boolean; detail: string; }
export interface JudgeResult {
  participant: string; brief_id: string; division: Division; track: Track;
  score: number; components: Record<string, number>;
  checks: CheckResult[]; flags: string[];
  build_ok: boolean; smoke_ok: boolean; load_ms: number;
  ratable: boolean;
}

// Minimal env buat spawn command dari SUBMISSION PESERTA (untrusted).
// Sengaja TIDAK inherit process.env penuh -- kalau job runner suatu saat nambah secret
// baru (API key, token, dll) ke env, build_cmd peserta tetap gak bisa baca itu.
// PATH wajib ada biar toolchain (node/npm/etc) ketemu; HOME/TEMP buat cache tool normal.
function untrustedEnv(): NodeJS.ProcessEnv {
  const { PATH, HOME, TEMP, TMP, SystemRoot, windir } = process.env;
  return { PATH, HOME, TEMP, TMP, SystemRoot, windir, CI: "true", NODE_ENV: "production" } as NodeJS.ProcessEnv;
}

export function sh(cmd: string, cwd: string, timeoutMs = 120000): { ok: boolean; out: string } {
  try {
    const out = execSync(cmd, { cwd, timeout: timeoutMs, stdio: "pipe", encoding: "utf8" });
    return { ok: true, out };
  } catch (e: any) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") + (e.message || "") };
  }
}

// Sama seperti sh(), tapi buat menjalankan command yang isinya DIKONTROL PESERTA
// (mis. build_cmd dari arena.json). Env di-strip ke minimal -- lihat untrustedEnv().
// Ini bukan sandbox penuh (masih shared filesystem/network/CPU jika runner shared),
// tapi menutup jalur paling murah buat curi secret: baca process.env dari dalam
// build_cmd/postinstall script peserta.
export function shUntrusted(cmd: string, cwd: string, timeoutMs = 120000): { ok: boolean; out: string } {
  try {
    const out = execSync(cmd, { cwd, timeout: timeoutMs, stdio: "pipe", encoding: "utf8", env: untrustedEnv() });
    return { ok: true, out };
  } catch (e: any) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") + (e.message || "") };
  }
}

export const log = (...a: unknown[]) => console.log("[assay]", ...a);
