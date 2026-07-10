import { existsSync } from "node:fs";
import { join } from "node:path";
import { sh } from "../util.js";
import type { Manifest } from "./manifest.js";

export function buildSubmission(dir: string, m: Manifest): { ok: boolean; distPath: string; log: string } {
  const res = sh(m.build_cmd, dir, 180000);
  const distPath = join(dir, m.dist_dir);
  const hasIndex = existsSync(join(distPath, "index.html"));
  return { ok: res.ok && hasIndex, distPath, log: res.out + (hasIndex ? "" : `\n[dist_dir '${m.dist_dir}/index.html' tidak ditemukan]`) };
}
