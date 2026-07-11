// Unit test murni utk spearman() -- TANPA browser, jalan di Node polos.
// Verifikasi formula + tie-handling sebelum dipercaya buat validasi golden set.
import { spearman } from "../src/score/spearman.js";

let failures = 0;
function expect(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { failures++; console.error(`  FAIL ${msg}`); }
}

console.log("[unit] urutan sempurna (harness score turun monoton sesuai expectedRank) -> rho harus 1");
const perfect = spearman([
  { id: "a", score: 100, expectedRank: 1 },
  { id: "b", score: 91,  expectedRank: 2 },
  { id: "c", score: 35,  expectedRank: 3 },
]);
expect(Math.abs(perfect.rho - 1) < 1e-9, `rho === 1 (dapat ${perfect.rho})`);

console.log("[unit] urutan kebalik total -> rho harus -1");
const inverted = spearman([
  { id: "a", score: 10, expectedRank: 1 },
  { id: "b", score: 50, expectedRank: 2 },
  { id: "c", score: 90, expectedRank: 3 },
]);
expect(Math.abs(inverted.rho - -1) < 1e-9, `rho === -1 (dapat ${inverted.rho})`);

console.log("[unit] kasus curang outrank jelek (BUG LAMA, sebelum fix multiplicative gate) -> rho HARUS < 1, buktiin regression guard bisa nangkep");
const buggedOldBehavior = spearman([
  { id: "good",   score: 100, expectedRank: 1 },
  { id: "jelek",  score: 84,  expectedRank: 2 }, // jujur, ada bug -- seharusnya rank 2
  { id: "curang", score: 92,  expectedRank: 3 }, // cheat -- score numerik lama LEBIH TINGGI dari jelek, seharusnya rank 3
]);
expect(buggedOldBehavior.rho < 1, `rho < 1 saat cheat outrank jujur (dapat ${buggedOldBehavior.rho.toFixed(3)}) -- INI YANG DITANGKEP tests/spearman.validate.ts sebelum fix cli.ts`);

console.log("[unit] ties di score -> gak crash, average-rank formula jalan");
const ties = spearman([
  { id: "a", score: 80, expectedRank: 1 },
  { id: "b", score: 80, expectedRank: 2 },
  { id: "c", score: 40, expectedRank: 3 },
]);
expect(!Number.isNaN(ties.rho), `rho bukan NaN saat ada ties (dapat ${ties.rho})`);

if (failures > 0) { console.error(`\n[unit] ${failures} assertion GAGAL.`); process.exit(1); }
console.log("\n[unit] semua assertion spearman() lulus.");
