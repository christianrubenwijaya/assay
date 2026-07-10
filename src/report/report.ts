import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { JudgeResult } from "../util.js";

export function writeReport(outDir: string, r: JudgeResult): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "score.json"), JSON.stringify(r, null, 2));
  const rows = r.checks.map(c => `| ${c.pass ? "✓" : "✗"} | ${c.seed ? "🌱 " : ""}${c.label} | ${c.detail} |`).join("\n");
  const md = `# ASSAY report — ${r.participant}
**Brief:** ${r.brief_id} · **Track:** ${r.track} · **Division:** ${r.division}
**SCORE: ${r.score}/100** · build=${r.build_ok ? "ok" : "FAIL"} · smoke=${r.smoke_ok ? "ok" : "FAIL"} · load=${r.load_ms}ms
**Flags:** ${r.flags.length ? r.flags.join(", ") : "—"}

| ok | check | detail |
|----|-------|--------|
${rows}
`;
  writeFileSync(join(outDir, "report.md"), md);
}

export async function postDiscord(webhook: string | undefined, r: JudgeResult): Promise<void> {
  const line = `**${r.participant}** — ${r.brief_id} — **${r.score}/100** ${r.flags.length ? "⚠️ " + r.flags.join(",") : "✅"}`;
  if (!webhook) { console.log("[discord:stub]", line); return; }
  try { await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: line }) }); }
  catch (e: any) { console.log("[discord:error]", e.message); }
}
