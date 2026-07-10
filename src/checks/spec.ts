import type { Page } from "playwright";
import type { CheckResult } from "../util.js";

export interface BriefCheck { id: string; label: string; seed: boolean; run: (page: Page, seed: any) => Promise<{ pass: boolean; detail: string }>; }
export interface Brief { id: string; title: string; checks: BriefCheck[]; }

export async function runBrief(brief: Brief, page: Page, seed: any): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  for (const c of brief.checks) {
    try { const r = await c.run(page, seed); out.push({ id: c.id, label: c.label, seed: c.seed, pass: r.pass, detail: r.detail }); }
    catch (e: any) { out.push({ id: c.id, label: c.label, seed: c.seed, pass: false, detail: "error: " + e.message }); }
  }
  return out;
}
