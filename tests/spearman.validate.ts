// Validasi ranking harness pakai Spearman rank correlation lawan golden set (3 fixture
// publik). Ini REGRESSION GUARD atas "apakah urutan skor match urutan kualitas yang
// disepakati manusia" -- good (jujur, sempurna) > jelek (jujur, ada bug) > curang
// (mekanik mulus tapi seed salah -- integritas kalah, harus paling bawah walau
// "keliatan" paling mulus). n=3 SANGAT kecil -- ini BUKAN bukti akurasi statistik,
// cuma bukti arah (sign) gak kebalik. Golden set perlu diperluas (lebih banyak
// fixture, lebih banyak brief) sebelum rho ini bisa dipakai sebagai klaim akurasi
// buat kompetisi berbayar/reputasi -- lihat README "Known gaps".
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { judgeSubmission } from "../src/cli.js";
import { spearman, type RankedItem } from "../src/score/spearman.js";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "out", "_spearman");

const FIXTURES: { name: string; folder: string; url: string; seed: string; expectedRank: number }[] = [
  { name: "good",   folder: "assay-sample-good",  url: "https://github.com/christianrubenwijaya/assay-sample-good",  seed: "teko terbang",  expectedRank: 1 }, // terbaik
  { name: "jelek",  folder: "assay-dummy-jelek",  url: "https://github.com/christianrubenwijaya/assay-dummy-jelek",  seed: "Kaktus Marah", expectedRank: 2 }, // jujur, ada bug
  { name: "curang", folder: "assay-dummy-curang", url: "https://github.com/christianrubenwijaya/assay-dummy-curang", seed: "Kaktus Marah", expectedRank: 3 }, // cheat -- harus paling bawah
];

function ensureFixture(f: typeof FIXTURES[number]): string {
  const dir = resolve(ROOT, f.folder);
  if (!existsSync(dir)) execSync(`git clone --depth 1 "${f.url}" "${f.folder}"`, { cwd: ROOT, stdio: "inherit" });
  return dir;
}

async function main() {
  const items: RankedItem[] = [];
  for (const f of FIXTURES) {
    const dir = ensureFixture(f);
    const r = await judgeSubmission({
      submissionDir: dir, participant: f.name, briefId: "01-endless-runner",
      seed: { theme: f.seed }, division: "open", track: "casual", outDir: OUT,
    });
    console.log(`  ${f.name}: score=${r.score} ratable=${r.ratable} flags=[${r.flags.join(",")}]`);
    items.push({ id: f.name, score: r.score, expectedRank: f.expectedRank });
  }

  const { rho, n } = spearman(items);
  console.log(`\n[spearman] rho=${rho.toFixed(3)} (n=${n} -- CATATAN: n=3 kekecilan buat klaim statistik, lihat komentar file ini)`);

  // n=3 punya cuma 6 kemungkinan urutan -- threshold ketat (rho===1) di sini masuk akal
  // krn golden set sekecil ini SEHARUSNYA gak punya ambiguitas: urutan kualitasnya jelas.
  const ok = rho === 1;
  if (!ok) {
    console.error(`[spearman] FAIL -- urutan skor harness TIDAK match urutan kualitas yang disepakati.`);
    console.error(`[spearman] Ini artinya submission curang bisa outrank submission jujur -- rating gak valid. JANGAN pakai buat kompetisi sampai ini fixed.`);
    process.exit(1);
  }
  console.log("[spearman] rho=1 -- urutan skor match urutan kualitas golden set. (Regression guard lulus, BUKAN bukti akurasi statistik krn n kecil.)");
}

main();
