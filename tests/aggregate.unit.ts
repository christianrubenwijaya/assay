// Unit test murni utk aggregate() -- TANPA browser, jalan di Node polos.
// Buktiin bug track-level renormalization (competitive kecap ~70, final kecap ~60)
// udah kefix, dan casual (satu-satunya track buat Jam #1) TETAP gak berubah.
import { aggregate } from "../src/score/aggregate.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const weights = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "config/weights.json"), "utf8"));

let failures = 0;
function expect(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { failures++; console.error(`  FAIL ${msg}`); }
}

const perfectPresent = { build: 1, smoke: 1, spec_seed: 1 };

console.log("[unit] casual -- harus TETAP 100 (regression check, gak boleh berubah)");
const casual = aggregate(perfectPresent, weights.harness_components, "casual", weights.tracks);
expect(casual.score === 100, `casual.score === 100 (dapat ${casual.score})`);

console.log("[unit] competitive TANPA panel dihitung -- sebelum fix ke-cap ~70, sekarang harus 100");
const competitiveNoPanel = aggregate(perfectPresent, weights.harness_components, "competitive", weights.tracks);
expect(competitiveNoPanel.score === 100, `competitive (panel blm jalan) === 100, BUKAN dicap 70 (dapat ${competitiveNoPanel.score})`);

console.log("[unit] final TANPA panel/human dihitung -- sebelum fix ke-cap ~60, sekarang harus 100");
const finalNoPanelHuman = aggregate(perfectPresent, weights.harness_components, "final", weights.tracks);
expect(finalNoPanelHuman.score === 100, `final (panel/human blm jalan) === 100, BUKAN dicap 60 (dapat ${finalNoPanelHuman.score})`);

console.log("[unit] competitive DENGAN panel dihitung beneran (mis. panel=0.5) -- harus kombinasi weighted, bukan 100 dan bukan capped-70");
const competitiveWithPanel = aggregate(perfectPresent, weights.harness_components, "competitive", weights.tracks, { panel: 0.5 });
expect(competitiveWithPanel.score === 85, `competitive (harness=1.0, panel=0.5) === 85 (dapat ${competitiveWithPanel.score})`);

console.log("[unit] harness sub-score renormalization TETAP jalan kalau ada sub-komponen kosong (mis. build fail)");
const buildFail = aggregate({ build: 0 }, weights.harness_components, "casual", weights.tracks);
expect(buildFail.score === 0, `build fail -> score 0 (dapat ${buildFail.score})`);

console.log("[unit] weights.json sum check -- harness_components & setiap track harus total 1.0");
const hcSum = Object.values(weights.harness_components as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
expect(Math.abs(hcSum - 1) < 1e-9, `harness_components sum === 1.0 (dapat ${hcSum})`);
for (const [t, v] of Object.entries(weights.tracks as Record<string, Record<string, number>>)) {
  const s = Object.values(v).reduce((a, b) => a + b, 0);
  expect(Math.abs(s - 1) < 1e-9, `track '${t}' weights sum === 1.0 (dapat ${s})`);
}

if (failures > 0) { console.error(`\n[unit] ${failures} assertion GAGAL.`); process.exit(1); }
console.log("\n[unit] semua assertion lulus. Bug track-level renormalization TERBUKTI fixed (bukan klaim).");
