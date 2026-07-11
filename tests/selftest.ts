// Self-test Gate A: jalanin harness beneran lawan 3 fixture publik (good/jelek/curang)
// dan assert pola skor+flag yang diharapkan. Ini BUKTI, bukan klaim -- kalau file ini
// gak ada atau gak lulus, jangan percaya klaim apapun soal "Gate A closed" di README.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { judgeSubmission } from "../src/cli.js";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "out", "_selftest");

const FIXTURES: Record<string, { folder: string; url: string; seed: string }> = {
  good:   { folder: "assay-sample-good",  url: "https://github.com/christianrubenwijaya/assay-sample-good",  seed: "teko terbang" },
  jelek:  { folder: "assay-dummy-jelek",  url: "https://github.com/christianrubenwijaya/assay-dummy-jelek",  seed: "Kaktus Marah" },
  curang: { folder: "assay-dummy-curang", url: "https://github.com/christianrubenwijaya/assay-dummy-curang", seed: "Kaktus Marah" },
};

function ensureFixture(name: string): string {
  const f = FIXTURES[name];
  const dir = resolve(ROOT, f.folder);
  if (!existsSync(dir)) {
    console.log(`[selftest] clone fixture ${name} <- ${f.url}`);
    execSync(`git clone --depth 1 "${f.url}" "${f.folder}"`, { cwd: ROOT, stdio: "inherit" });
  }
  return dir;
}

let failures = 0;
function expect(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { failures++; console.error(`  FAIL ${msg}`); }
}

async function run(name: string) {
  const f = FIXTURES[name];
  const dir = ensureFixture(name);
  return judgeSubmission({
    submissionDir: dir, participant: name, briefId: "01-endless-runner",
    seed: { theme: f.seed }, division: "open", track: "casual", outDir: OUT,
  });
}

async function main() {
  console.log("[selftest] good (submission bersih, harus sempurna)");
  const good = await run("good");
  expect(good.score === 100, `score === 100 (dapat ${good.score})`);
  expect(good.flags.length === 0, `tanpa flag (dapat ${JSON.stringify(good.flags)})`);
  expect(good.ratable === true, `ratable === true (dapat ${good.ratable})`);

  console.log("[selftest] jelek (bug fungsional nyata: restart & skor macet -- BUKAN cheat)");
  const jelek = await run("jelek");
  expect(jelek.score < 95, `score turun karena bug fungsional (dapat ${jelek.score})`);
  expect(!jelek.flags.some(f => f.startsWith("SEED_MISMATCH")), `TIDAK boleh kena SEED_MISMATCH (dapat ${JSON.stringify(jelek.flags)})`);
  expect(jelek.ratable === true, `bug jujur tetap ratable === true (dapat ${jelek.ratable})`);

  console.log("[selftest] curang (mekanik mulus + seed salah -- pola prebuilt klasik)");
  const curang = await run("curang");
  expect(curang.flags.some(f => f.startsWith("SEED_MISMATCH")), `HARUS kena SEED_MISMATCH (dapat ${JSON.stringify(curang.flags)})`);
  expect(curang.ratable === false, `curang HARUS ratable === false (dapat ${curang.ratable})`);

  console.log("[selftest] INVARIAN INTEGRITAS: curang HARUS skor lebih rendah dari jelek");
  expect(curang.score < jelek.score, `curang(${curang.score}) < jelek(${jelek.score}) -- nyontek gak boleh outrank usaha jujur yg buggy`);

  if (failures > 0) {
    console.error(`\n[selftest] ${failures} assertion GAGAL. Gate A TIDAK boleh dianggap closed.`);
    process.exit(1);
  }
  console.log("\n[selftest] semua assertion lulus. Pola Gate A terverifikasi lewat pipeline asli.");
}

main();
