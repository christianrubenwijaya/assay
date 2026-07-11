// THROWAWAY verifier -- jsdom, bukan Playwright asli. Jsdom gak render layout, jadi
// offsetParent selalu null -> check "win visible" di-SKIP di sini (dicatat unverified).
// Tujuannya cuma nge-cross-check LOGIC JS-nya sebelum diserahkan (Ben tetep WAJIB
// jalanin npm run judge asli sebelum percaya).
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const cases = [
  { variant: "good",   brief: "02-platformer-gravity-flip", seed: { protagonist: "batu ajaib" } },
  { variant: "jelek",  brief: "02-platformer-gravity-flip", seed: { protagonist: "batu ajaib" } },
  { variant: "curang", brief: "02-platformer-gravity-flip", seed: { protagonist: "batu ajaib" } },
  { variant: "good",   brief: "03-memory-reshuffle", seed: { x: 4, theme: "buah tropis" } },
  { variant: "jelek",  brief: "03-memory-reshuffle", seed: { x: 4, theme: "buah tropis" } },
  { variant: "curang", brief: "03-memory-reshuffle", seed: { x: 4, theme: "buah tropis" } },
  { variant: "good",   brief: "10-idle-clicker-prestige", seed: { costCurve: 1.15, resourceName: "kopi sachet" } },
  { variant: "jelek",  brief: "10-idle-clicker-prestige", seed: { costCurve: 1.15, resourceName: "kopi sachet" } },
  { variant: "curang", brief: "10-idle-clicker-prestige", seed: { costCurve: 1.15, resourceName: "kopi sachet" } },
];

function checks02(win, seed) {
  const d = win.document;
  const out = {};
  out.canvas = d.querySelectorAll("canvas#game, #game").length > 0;
  out["hook-start"] = typeof win.__assay?.start === "function";
  const before = d.body.getAttribute("data-gravity") || "down";
  win.__assay?.triggerFlip?.();
  const after = d.body.getAttribute("data-gravity") || "down";
  out.flip = before !== after;
  win.__assay?.forceWin?.();
  out.win_element_exists = !!d.querySelector("#win, .win-screen"); // gak cek visible (jsdom no layout)
  const body = (d.body.textContent || "").toLowerCase();
  out.seed = body.includes(String(seed.protagonist).toLowerCase());
  return out;
}
function checks03(win, seed) {
  const d = win.document;
  const out = {};
  out.grid = d.querySelectorAll(".card, [data-card]").length >= 4;
  out["hook-start"] = typeof win.__assay?.start === "function";
  const beforeM = win.__assay?.getMatchedCount?.() ?? -1;
  win.__assay?.forceMatch?.();
  const afterM = win.__assay?.getMatchedCount?.() ?? -1;
  out.match = afterM > beforeM;
  const beforeR = win.__assay?.getReshuffleCount?.() ?? -1;
  for (let i = 0; i < seed.x + 1; i++) win.__assay?.flipCard?.(i % 2);
  const afterR = win.__assay?.getReshuffleCount?.() ?? -1;
  out.reshuffle = afterR > beforeR;
  win.__assay?.forceWin?.();
  out.win_element_exists = !!d.querySelector("#win, .win-screen");
  const body = (d.body.textContent || "").toLowerCase();
  out["seed-theme"] = body.includes(String(seed.theme).toLowerCase());
  return out;
}
function checks10(win, seed) {
  const d = win.document;
  const out = {};
  const el = d.querySelector("#count");
  const before = Number((el?.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
  win.__assay?.click?.();
  const after = Number((el?.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
  out.counter = after > before;
  out["hook-start"] = typeof win.__assay?.start === "function";
  const beforeT = Number((el?.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
  win.__assay?.tick?.(10);
  const afterT = Number((el?.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
  out["auto-gen"] = afterT > beforeT;
  const beforeP = win.__assay?.getPrestigeCount?.() ?? -1;
  win.__assay?.forcePrestige?.(seed.costCurve);
  const afterP = win.__assay?.getPrestigeCount?.() ?? -1;
  const countAfter = Number((el?.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
  out.prestige = afterP > beforeP && countAfter === 0;
  const body = (d.body.textContent || "").toLowerCase();
  out.seed = body.includes(String(seed.resourceName).toLowerCase());
  return out;
}

const fns = { "02-platformer-gravity-flip": checks02, "03-memory-reshuffle": checks03, "10-idle-clicker-prestige": checks10 };

for (const c of cases) {
  const path = `fixtures/multi-${c.variant}/${c.brief}/dist/index.html`;
  const html = readFileSync(path, "utf8");
  const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true });
  const results = fns[c.brief](dom.window, c.seed);
  console.log(`${c.variant.padEnd(7)} ${c.brief.padEnd(28)} ${JSON.stringify(results)}`);
}
