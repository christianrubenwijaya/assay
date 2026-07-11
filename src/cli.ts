import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, rmSync, mkdirSync, cpSync } from "node:fs";
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
    ratable: true,
  };

  // isolate: copy submission to a clean work dir (cross-platform, no shelling to Unix cp/rm/mkdir)
  const work = join(o.outDir, "_work", o.participant);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  cpSync(o.submissionDir, work, { recursive: true });

  // GATE: timestamp (skipped local — needs GitHub API in CI)
  if (o.t0 && o.repoCreatedAt && new Date(o.repoCreatedAt) < new Date(o.t0)) {
    flags.push("TIMESTAMP_FAIL"); base.ratable = false; writeReport(join(o.outDir, o.participant), base); return base;
  }

  // GATE: manifest
  const man = readManifest(work);
  if (!man.ok) { flags.push("MANIFEST_FAIL:" + man.error); base.ratable = false; writeReport(join(o.outDir, o.participant), base); await postDiscord(process.env.DISCORD_WEBHOOK, base); return base; }
  const m = man.manifest!;

  // GATE: build
  const b = buildSubmission(work, m);
  base.build_ok = b.ok;
  if (!b.ok) { flags.push("BUILD_FAIL"); base.ratable = false; const agg = aggregate({ build: 0 }, weights.harness_components, o.track, weights.tracks); base.score = agg.score; base.components = agg.components; writeReport(join(o.outDir, o.participant), base); await postDiscord(process.env.DISCORD_WEBHOOK, base); return base; }

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

  // spec_seed = GATE, bukan rata-rata biasa. Seed check adalah satu-satunya sinyal
  // anti-prebuilt yang low-variance (Bible §6) -- kalau dirata-rata sama bobot dengan
  // check fungsional lain (mis. 1 dari 8 check), gagal seed cuma nyenggol skor
  // beberapa persen. Itu bug: submission prebuilt-dengan-seed-salah (curang) bisa
  // ke-skor LEBIH TINGGI dari submission jujur yang punya bug fungsional beneran
  // (jelek) -- rating jadi favor nyontek drpd usaha jujur. Fix: kalikan, bukan rata-rata.
  // nonSeedFrac * seedFrac -- seed gagal total (0) -> component collapse ke 0,
  // proporsional kalau brief punya >1 seed-check di masa depan.
  const nonSeed = checks.filter(c => !c.seed), seed = checks.filter(c => c.seed);
  const nonSeedFrac = nonSeed.length ? nonSeed.filter(c => c.pass).length / nonSeed.length : 1;
  const seedFrac = seed.length ? seed.filter(c => c.pass).length / seed.length : 1;
  const specSeedComponent = nonSeedFrac * seedFrac;

  const agg = aggregate({ build: 1, smoke: smokeOk ? 1 : 0, spec_seed: specSeedComponent }, weights.harness_components, o.track, weights.tracks);
  base.score = agg.score; base.components = agg.components;

  // prebuilt signature: semua non-seed lolos tapi seed gagal
  if (seed.length && seedFrac === 0 && nonSeed.length && nonSeedFrac === 1) flags.push("SEED_MISMATCH(prebuilt?)");
  if (seedFrac < 1 && seed.length) { flags.push("SEED_FAIL"); base.ratable = false; }

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
  }).then(r => { log(`${r.participant}: ${r.score}/100 ratable=${r.ratable} flags=[${r.flags.join(",")}]`); process.exit(0); });
}
