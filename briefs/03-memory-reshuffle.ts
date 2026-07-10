import type { Brief } from "../src/checks/spec.js";

const brief: Brief = {
    id: "03-memory-reshuffle",
    title: "Memory cards yang reshuffle tiap X flip",
    checks: [
      { id: "grid", label: "Grid kartu render (.card / [data-card])", seed: false,
             run: async (p) => { const n = await p.locator(".card, [data-card]").count(); return { pass: n >= 4, detail: `cards=${n}` }; } },
      { id: "hook-start", label: "window.__assay.start = function", seed: false,
             run: async (p) => { const ok = await p.evaluate(() => typeof (window as any).__assay?.start === "function"); return { pass: ok, detail: `hook=${ok}` }; } },
      { id: "match", label: "Match logic bertambah via forceMatch()", seed: false,
             run: async (p) => {
                       const ok = await p.evaluate(async () => {
                                   const a = (window as any).__assay; if (!a?.forceMatch || !a?.getMatchedCount) return false;
                                   const before = a.getMatchedCount();
                                   a.forceMatch();
                                   await new Promise(r => setTimeout(r, 150));
                                   return a.getMatchedCount() > before;
                       });
                       return { pass: ok, detail: `match_progressed=${ok}` }; } },
      { id: "reshuffle", label: "Reshuffle trigger setelah X flip (seed)", seed: true,
             run: async (p, seed) => {
                       const x = Number(seed?.x ?? 4);
                       const ok = await p.evaluate(async (x) => {
                                   const a = (window as any).__assay; if (!a?.flipCard || !a?.getReshuffleCount) return false;
                                   const before = a.getReshuffleCount();
                                   for (let i = 0; i < x + 1; i++) { a.flipCard(i % 2); await new Promise(r => setTimeout(r, 30)); }
                                   return a.getReshuffleCount() > before;
                       }, x);
                       return { pass: ok, detail: `reshuffle_after_${x}_flips=${ok}` }; } },
      { id: "win", label: "Win screen via forceWin()", seed: false,
             run: async (p) => {
                       const ok = await p.evaluate(async () => {
                                   const a = (window as any).__assay; if (!a?.forceWin) return false;
                                   a.forceWin();
                                   await new Promise(r => setTimeout(r, 150));
                                   const el = document.querySelector("#win, .win-screen") as HTMLElement | null;
                                   return !!el && el.offsetParent !== null;
                       });
                       return { pass: ok, detail: `win_visible=${ok}` }; } },
      { id: "seed-theme", label: "Tema ikon dari seed hadir di visible text (bukan script/comment)", seed: true,
             run: async (p, seed) => {
                       const theme = String(seed?.theme ?? "").toLowerCase();
                       // HANYA innerText -- outerHTML ikut nyerap komentar <script> yg gak dirender.
                       const body = (await p.evaluate(() => document.body.innerText)).toLowerCase();
                       const pass = theme.length > 0 && body.includes(theme);
                       return { pass, detail: `cari '${theme}' di visible text -> ${pass}` }; } },
        ],
};
export default brief;
