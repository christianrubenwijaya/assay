// Seed SPACE per brief -- mixed-radix encoding. Setiap brief punya beberapa "dimensi"
// (list kata / range angka). Index 0..cardinality-1 di-decode jadi kombinasi unik lewat
// pembagian modulo berantai (mixed-radix), standar buat "hitung mundur" kombinasi tanpa
// perlu materialize semua kombinasi ke memori/JSON.
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Dim = { size: number; get: (i: number) => any };

function numRange(lo: number, hi: number, step = 1): Dim {
  const size = Math.round((hi - lo) / step) + 1; // round, bukan floor -- hindari float epsilon (0.35/0.05 != 7.0 persis di IEEE754)
  return { size, get: (i) => Math.round((lo + i * step) * 1e6) / 1e6 };
}
function listDim(arr: any[]): Dim { return { size: arr.length, get: (i) => arr[i] }; }

export function loadSpace(root: string): any {
  return JSON.parse(readFileSync(join(root, "config/seed_space.json"), "utf8"));
}

function dimsFor(briefId: string, space: any): { dims: Record<string, Dim>; build: (vals: Record<string, any>) => Record<string, any> } {
  const s = space[briefId];
  if (!s) throw new Error(`seed_space.json: brief '${briefId}' tidak ada`);
  if (briefId === "01-endless-runner") {
    return {
      dims: { noun: listDim(s.nouns), modifier: listDim(s.modifiers) },
      build: (v) => ({ theme: s.join.replace("{noun}", v.noun).replace("{modifier}", v.modifier) }),
    };
  }
  if (briefId === "02-platformer-gravity-flip") {
    return {
      dims: { n: numRange(s.n_range[0], s.n_range[1]), protagonist: listDim(s.protagonists), palette: listDim(s.palettes) },
      build: (v) => ({ n: v.n, protagonist: v.protagonist, palette: v.palette }),
    };
  }
  if (briefId === "03-memory-reshuffle") {
    return {
      dims: { x: numRange(s.x_range[0], s.x_range[1]), pairs: numRange(s.pairs_range[0], s.pairs_range[1]), theme: listDim(s.themes) },
      build: (v) => ({ x: v.x, pairs: v.pairs, theme: v.theme }),
    };
  }
  if (briefId === "10-idle-clicker-prestige") {
    return {
      dims: { costCurve: numRange(s.cost_curve_range[0], s.cost_curve_range[1], s.cost_curve_step), resourceName: listDim(s.resource_names) },
      build: (v) => ({ costCurve: v.costCurve, resourceName: v.resourceName }),
    };
  }
  throw new Error(`seed_space.json: brief '${briefId}' belum ada mapping dimensi di dimsFor()`);
}

export function cardinality(briefId: string, space: any): number {
  const { dims } = dimsFor(briefId, space);
  return Object.values(dims).reduce((acc, d) => acc * d.size, 1);
}

// index 0..cardinality-1 -> seed object. Deterministik & total (bijective ke ruang kombinasi).
export function seedAt(briefId: string, space: any, index: number): Record<string, any> {
  const { dims, build } = dimsFor(briefId, space);
  const keys = Object.keys(dims);
  let rem = index;
  const vals: Record<string, any> = {};
  for (const k of keys) {
    const d = dims[k];
    vals[k] = d.get(rem % d.size);
    rem = Math.floor(rem / d.size);
  }
  return build(vals);
}
