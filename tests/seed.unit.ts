// Unit test murni utk src/seed/{space,assign}.ts -- TANPA browser.
import { loadSpace, cardinality, seedAt } from "../src/seed/space.js";
import { assignSeeds } from "../src/seed/assign.js";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const space = loadSpace(ROOT);

let failures = 0;
function expect(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { failures++; console.error(`  FAIL ${msg}`); }
}

const BRIEFS = ["01-endless-runner", "02-platformer-gravity-flip", "03-memory-reshuffle", "10-idle-clicker-prestige"];

console.log("[unit] cardinality tiap brief JAUH lebih besar dari pool lama (4-6 entri)");
for (const b of BRIEFS) {
  const c = cardinality(b, space);
  console.log(`  ${b}: cardinality=${c}`);
  expect(c >= 200, `${b} cardinality >= 200 (dapat ${c})`);
}

console.log("[unit] seedAt() deterministik -- index sama harus hasil sama persis");
const a1 = seedAt("01-endless-runner", space, 42);
const a2 = seedAt("01-endless-runner", space, 42);
expect(JSON.stringify(a1) === JSON.stringify(a2), `seedAt(42) === seedAt(42) (dapat ${JSON.stringify(a1)} vs ${JSON.stringify(a2)})`);

console.log("[unit] seedAt() bentuk output match yang dibaca briefs/*.ts");
const s01 = seedAt("01-endless-runner", space, 0);
expect(typeof s01.theme === "string" && s01.theme.length > 0, `01 punya field 'theme' string (dapat ${JSON.stringify(s01)})`);
const s02 = seedAt("02-platformer-gravity-flip", space, 0);
expect(typeof s02.n === "number" && typeof s02.protagonist === "string" && typeof s02.palette === "string", `02 punya n/protagonist/palette (dapat ${JSON.stringify(s02)})`);
const s03 = seedAt("03-memory-reshuffle", space, 0);
expect(typeof s03.x === "number" && typeof s03.pairs === "number" && typeof s03.theme === "string", `03 punya x/pairs/theme (dapat ${JSON.stringify(s03)})`);
const s10 = seedAt("10-idle-clicker-prestige", space, 0);
expect(typeof s10.costCurve === "number" && typeof s10.resourceName === "string", `10 punya costCurve/resourceName (dapat ${JSON.stringify(s10)})`);

console.log("[unit] assignSeeds() -- 50 peserta, brief 01, HARUS zero collision (invarian keras)");
const participants = Array.from({ length: 50 }, (_, i) => `peserta-${i}`);
const assigned = assignSeeds(participants, "01-endless-runner", "salt-rahasia-jam1", space);
const seen = new Set<string>();
let collisions = 0;
for (const [, seed] of assigned) {
  const key = JSON.stringify(seed);
  if (seen.has(key)) collisions++;
  seen.add(key);
}
expect(assigned.size === 50, `semua 50 peserta ke-assign (dapat ${assigned.size})`);
expect(collisions === 0, `0 collision di antara 50 peserta (dapat ${collisions})`);

console.log("[unit] assignSeeds() deterministik lintas run -- salt+peserta sama harus hasil sama (buat audit sengketa)");
const assigned2 = assignSeeds(participants, "01-endless-runner", "salt-rahasia-jam1", space);
let mismatches = 0;
for (const pid of participants) if (JSON.stringify(assigned.get(pid)) !== JSON.stringify(assigned2.get(pid))) mismatches++;
expect(mismatches === 0, `re-run assignSeeds dgn salt sama = hasil identik (dapat ${mismatches} mismatch)`);

console.log("[unit] salt beda -> assignment beda (peserta gak bisa nebak seed sebelum salt diumumin)");
const assigned3 = assignSeeds(participants, "01-endless-runner", "salt-BEDA", space);
let sameAsSalt1 = 0;
for (const pid of participants) if (JSON.stringify(assigned.get(pid)) === JSON.stringify(assigned3.get(pid))) sameAsSalt1++;
expect(sameAsSalt1 < participants.length, `salt beda -> gak semua peserta dapet seed yg sama kayak salt lama (dapat ${sameAsSalt1}/${participants.length} sama)`);

console.log("[unit] assignSeeds() throw kalau peserta > cardinality (fail-fast SEBELUM event, bukan pas live)");
try {
  assignSeeds(Array.from({ length: 100000 }, (_, i) => `p${i}`), "03-memory-reshuffle", "x", space);
  expect(false, "harusnya throw krn 100000 peserta > cardinality brief 03");
} catch (e: any) {
  expect(/cardinality/.test(e.message), `throw dengan pesan jelas soal cardinality (dapat: ${e.message})`);
}

if (failures > 0) { console.error(`\n[unit] ${failures} assertion GAGAL.`); process.exit(1); }
console.log("\n[unit] semua assertion seed space/assign lulus.");
