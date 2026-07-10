import type { Brief } from "../src/checks/spec.js";

const brief: Brief = {
    id: "10-idle-clicker-prestige",
    title: "Idle clicker + prestige",
    checks: [
      { id: "counter", label: "#count ada & bertambah via window.__assay.click()", seed: false,
             run: async (p) => {
                       const ok = await p.evaluate(async () => {
                                   const a = (window as any).__assay; if (!a?.click) return false;
                                   const el = document.querySelector("#count");
                                   if (!el) return false;
                                   const before = Number((el.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
                                   a.click();
                                   await new Promise(r => setTimeout(r, 100));
                                   const after = Number((el.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
                                   return after > before;
                       });
                       return { pass: ok, detail: `count_increased=${ok}` }; } },
      { id: "hook-start", label: "window.__assay.start = function", seed: false,
             run: async (p) => { const ok = await p.evaluate(() => typeof (window as any).__assay?.start === "function"); return { pass: ok, detail: `hook=${ok}` }; } },
      { id: "auto-gen", label: "Auto-generator jalan tanpa klik via window.__assay.tick()", seed: false,
             run: async (p) => {
                       const ok = await p.evaluate(async () => {
                                   const a = (window as any).__assay; if (!a?.tick) return false;
                                   const el = document.querySelector("#count");
                                   if (!el) return false;
                                   const before = Number((el.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
                                   a.tick(10);
                                   await new Promise(r => setTimeout(r, 100));
                                   const after = Number((el.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
                                   return after > before;
                       });
                       return { pass: ok, detail: `auto_generated=${ok}` }; } },
      { id: "prestige", label: "Prestige math benar via window.__assay.forcePrestige(curve)", seed: true,
             run: async (p, seed) => {
                       const curve = Number(seed?.costCurve ?? 1.15);
                       const ok = await p.evaluate(async (curve) => {
                                   const a = (window as any).__assay; if (!a?.forcePrestige || !a?.getPrestigeCount) return false;
                                   const before = a.getPrestigeCount();
                                   a.forcePrestige(curve);
                                   await new Promise(r => setTimeout(r, 100));
                                   const after = a.getPrestigeCount();
                                   const countEl = document.querySelector("#count");
                                   const resetOk = countEl ? (Number((countEl.textContent || "0").replace(/[^0-9.-]/g, "")) || 0) === 0 : true;
                                   return after > before && resetOk;
                       }, curve);
                       return { pass: ok, detail: `prestige_ok=${ok}` }; } },
      { id: "seed", label: "Nama resource dari seed hadir di visible text (bukan script/comment)", seed: true,
             run: async (p, seed) => {
                       const name = String(seed?.resourceName ?? "").toLowerCase();
                       // HANYA innerText -- outerHTML ikut nyerap komentar <script> yg gak dirender.
                       const body = (await p.evaluate(() => document.body.innerText)).toLowerCase();
                       const pass = name.length > 0 && body.includes(name);
                       return { pass, detail: `cari '${name}' di visible text -> ${pass}` }; } },
        ],
};
export default brief;
