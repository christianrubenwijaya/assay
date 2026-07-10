import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, rmSync } from "node:fs";
import { sh, log, type JudgeResult, type CheckResult, type Track, type Division } from "./util.js";
import { readManifest } from "./gates/manifest.js";
import { buildSubmission } from "./gates/build.js";
import { startServer } from "./gates/serve.js";
import { smokeCheck } from "./checks/smoke.js";
import { runBrief, type Brief } from "./checks/spec.js";
import { aggregate } from "./score/aggregate.js";
import { writeReport, postDiscord } from "./report/report.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const weights = JSON.parse(readFileSync(join(ROOT, "config/weights.json"), "utf8"));
const thresholds = JSON.parse(readFileSync(join(ROOT, "config/thresholds.json"), "utf8"));

export interface JudgeOpts {
  submissionDir: string; participant: string; briefId: string; seed: any;
  division: Division; track: Track; outDir: string; t0?: string; repoCreatedAt?: string;
}

export async function judgeSubmission(o: JudgeOpts): Promise<JudgeResult> {
  const flags: string[] = [];
  const base: JudgeResult = {
    participant: o.participant, brief_id: o.briefId, division: o.division, track: o.track,
    score: 0, components: {}, checks: [], flags, build_ok: false, smoke_ok: false, load_ms: 0,
  };

  // isolate: copy submission to a clean work dir
  const work = join(o.outDir, "_work", o.participant);
  sh(`rm -rf "${work}"`, ROOT);
  sh(`mkdir -p "${work}" && cp -r "${o.submissionDir}/." "${work}/"`, ROOT);

  // GATE: timestamp (skipped local — needs GitHub API in CI)
  if (o.t0 && o.repoCreatedAt && new Date(o.repoCreatedAt) < new Date(o.t0)) {
    flags.push("TIMESTAMP_FAIL"); base.flags = flags; writeReport(join(o.outDir, o.participant), base); return base;
  }

  // GATE: manifest
  const man = readManifest(work);
  if (!man.ok) { flags.push("MANIFEST_FAIL:" + man.error); writeReport(join(o.outDir, o.participant), base); await postDiscord(process.env.DISCORD_WEBHOOK, base); return base; }
  const m = man.manifest!;

  // GATE: build
  const b = buildSubmission(work, m);
  base.build_ok = b.ok;
  if (!b.ok) { flags.push("BUILD_FAIL"); const agg = aggregate({ build: 0 }, weights.harness_components, o.track, weights.tracks); base.score = agg.score; base.components = agg.components; writeReport(join(o.outDir, o.participant), base); await postDiscord(process.env.DISCORD_WEBHOOK, base); return base; }

  // serve + browser
  const srv = await startServer(b.distPath);
  const browser = await chromium.launch();
  let checks: CheckResult[] = []; let smokeOk = false; let loadMs = 0;
  try {
    const page = await browser.newPage();
    const sm = await smokeCheck(page, srv.url, thresholds.load_seconds);
    smokeOk = sm.ok; loadMs = sm.load_ms; base.smoke_ok = sm.ok; base.load_ms = sm.load_ms;
    if (!sm.ok) flags.push("SMOKE_FAIL:" + sm.detail);
    const briefMod = await import(pathToFileURL(join(ROOT, "briefs", o.briefId + ".ts")).href);
    const brief: Brief = briefMod.default;
    checks = await runBrief(brief, page, o.seed);
    await page.close();
  } finally { await browser.close(); srv.close(); }
  base.checks = checks;

  const specPass = checks.filter(c => c.pass).length / (checks.length || 1);
  const agg = aggregate({ build: 1, smoke: smokeOk ? 1 : 0, spec_seed: specPass }, weights.harness_components, o.track, weights.tracks);
  base.score = agg.score; base.components = agg.components;

  // prebuilt signature: semua non-seed lolos tapi seed gagal
  const nonSeed = checks.filter(c => !c.seed), seed = checks.filter(c => c.seed);
  if (seed.length && seed.every(c => !c.pass) && nonSeed.length && nonSeed.every(c => c.pass)) flags.push("SEED_MISMATCH(prebuilt?)");

  writeReport(join(o.outDir, o.participant), base);
  await postDiscord(process.env.DISCORD_WEBHOOK, base);
  return base;
}

// CLI wrapper
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a: any = Object.fromEntries(process.argv.slice(2).reduce((acc: string[][], v, i, arr) => { if (v.startsWith("--")) acc.push([v.slice(2), arr[i + 1]]); return acc; }, []));
  judgeSubmission({
    submissionDir: a.submission, participant: a.participant || "sub", briefId: a.brief,
    seed: a.seed ? JSON.parse(a.seed) : {}, division: a.division || "open", track: a.track || "casual",
    outDir: a.out || join(ROOT, "out"), t0: a.t0, repoCreatedAt: a.repoCreatedAt,
  }).then(r => { log(`${r.participant}: ${r.score}/100 flags=[${r.flags.join(",")}]`); process.exit(0); });
}
