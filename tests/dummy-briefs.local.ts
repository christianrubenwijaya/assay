// Dummy validation buat brief 02/03/10 -- LOCAL folder (fixtures/multi-*), BUKAN clone
// GitHub kayak tests/selftest.ts, karena fixture ini BELUM dipush ke repo manapun.
//
// STATUS: fixture ini ke-generate + dicek logic-nya lewat jsdom (npm run verify-fixtures-jsdom,
// semua match pola yang diharapkan), TAPI BELUM PERNAH dijalanin lawan harness+Playwright
// beneran (sandbox yang nulis ini nggak punya browser). JANGAN anggap brief 02/03/10
// "tervalidasi" sampai script ini beneran dijalanin dan lulus di mesin lo. Kalau ada yang
// meleset (mis. offsetParent/visibility beda antara jsdom vs Chromium beneran), perbaiki
// HTML di fixtures/multi-*/<brief>/dist/index.html, bukan perbaiki check di briefs/*.ts
// (kecuali emang ketemu bug di check-nya).
//
// Assert pola SAMA kayak brief 01 (tests/selftest.ts): good=sempurna, jelek=bug fungsional
// jujur (BUKAN kena seed-flag), curang=kena flag + score HARUS di bawah jelek.
import { resolve } from "node:path";
import { judgeSubmission } from "../src/cli.js";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "out", "_dummy_briefs");

const CASES: { brief: string; seed: any }[] = [
  { brief: "02-platformer-gravity-flip", seed: { n: 7, protagonist: "batu ajaib", palette: "neon" } },
  { brief: "03-memory-reshuffle", seed: { x: 4, pairs: 6, theme: "buah tropis" } },
  { brief: "10-idle-clicker-prestige", seed: { costCurve: 1.15, resourceName: "kopi sachet" } },
];

let failures = 0;
function expect(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { failures++; console.error(`  FAIL ${msg}`); }
}

async function run(brief: string, variant: string, seed: any) {
  const dir = resolve(ROOT, "fixtures", `multi-${variant}`, brief);
  return judgeSubmission({ submissionDir: dir, participant: `${variant}-${brief}`, briefId: brief, seed, division: "open", track: "casual", outDir: OUT });
}

async function main() {
  for (const c of CASES) {
    console.log(`\n[dummy] brief=${c.brief}`);
    const good = await run(c.brief, "good", c.seed);
    expect(good.score === 100, `good.score === 100 (dapat ${good.score})`);
    expect(good.flags.length === 0, `good tanpa flag (dapat ${JSON.stringify(good.flags)})`);
    expect(good.ratable === true, `good.ratable === true`);

    const jelek = await run(c.brief, "jelek", c.seed);
    expect(jelek.score < good.score, `jelek.score < good.score (jelek=${jelek.score}, good=${good.score})`);
    expect(!jelek.flags.some(f => f.startsWith("SEED_MISMATCH")), `jelek TIDAK boleh kena SEED_MISMATCH (dapat ${JSON.stringify(jelek.flags)})`);
    expect(jelek.ratable === true, `jelek.ratable === true (bug jujur tetap ratable)`);

    const curang = await run(c.brief, "curang", c.seed);
    expect(curang.flags.some(f => f.startsWith("SEED_MISMATCH")), `curang HARUS kena SEED_MISMATCH (dapat ${JSON.stringify(curang.flags)})`);
    expect(curang.ratable === false, `curang.ratable === false`);
    expect(curang.score < jelek.score, `INVARIAN: curang(${curang.score}) < jelek(${jelek.score})`);
  }

  if (failures > 0) { console.error(`\n[dummy] ${failures} assertion GAGAL. Brief 02/03/10 TIDAK boleh dianggap tervalidasi.`); process.exit(1); }
  console.log("\n[dummy] semua assertion lulus. Brief 02/03/10 sekarang punya bukti empiris (bukan cuma jsdom sanity check).");
}

main();
