import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const Manifest = z.object({
  brief_id: z.string(),
  division: z.enum(["standard", "open"]),
  build_cmd: z.string(),
  dist_dir: z.string(),
  toolchain: z.array(z.object({ name: z.string(), version: z.string().optional() })).min(1),
  boilerplate: z.array(z.string()).optional(),
  ai_assets: z.array(z.record(z.any())).optional(),
});
export type Manifest = z.infer<typeof Manifest>;

export function readManifest(dir: string): { ok: boolean; manifest?: Manifest; error?: string } {
  const p = join(dir, "arena.json");
  if (!existsSync(p)) return { ok: false, error: "arena.json tidak ada" };
  try {
    const parsed = Manifest.safeParse(JSON.parse(readFileSync(p, "utf8")));
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") };
    return { ok: true, manifest: parsed.data };
  } catch (e: any) { return { ok: false, error: "arena.json invalid JSON: " + e.message }; }
}
