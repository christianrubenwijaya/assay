import type { Brief } from "../src/checks/spec.js";

const brief: Brief = {
    id: "02-platformer-gravity-flip",
    title: "Platformer gravitasi kebalik tiap N detik",
    checks: [
      { id: "canvas", label: "Canvas/game root ada", seed: false,
             run: async (p) => { const n = await p.locator("canvas#game, #game").count(); return { pass: n > 0, detail: `game-root=${n}` }; } },
      { id: "hook-start", label: "window.__assay.start = function", seed: false,
             run: async (p) => { const ok = await p.evaluate(() => typeof (window as any).__assay?.start === "function"); return { pass: ok, detail: `hook=${ok}` }; } },
      { id: "flip", label: "Gravitasi kebalik terdeteksi setelah triggerFlip()", seed: false,
             run: async (p) => {
                       const ok = await p.evaluate(async () => {
                                   const a = (window as any).__assay; if (!a?.triggerFlip) return false;
                                   const before = document.body.getAttribute("data-gravity") || "down";
                                   a.triggerFlip();
                                   await new Promise(r => setTimeout(r, 150));
                                   const after = document.body.getAttribute("data-gravity") || "down";
                                   return before !== after;
                       });
                       return { pass: ok, detail: `gravity_flipped=${ok}` }; } },
      { id: "win", label: "Win state via forceWin() (<=3 level)", seed: false,
             run: async (p) => {
                       const ok = await p.evaluate(async () => {
                                   const a = (window as any).__assay; if (!a?.forceWin) return false;
                                   a.forceWin();
                                   await new Promise(r => setTimeout(r, 150));
                                   const el = document.querySelector("#win, .win-screen") as HTMLElement | null;
                                   return !!el && el.offsetParent !== null;
                       });
                       return { pass: ok, detail: `win_visible=${ok}` }; } },
      { id: "seed", label: "Nama protagonis dari seed hadir di visible text (bukan script/comment)", seed: true,
             run: async (p, seed) => {
                       const name = String(seed?.protagonist ?? "").toLowerCase();
                       // HANYA innerText -- outerHTML ikut nyerap komentar <script> yg gak dirender,
                       // bisa di-fake submission prebuilt cukup nulis seed di komentar kode.
                       const body = (await p.evaluate(() => document.body.innerText)).toLowerCase();
                       const pass = name.length > 0 && body.includes(name);
                       return { pass, detail: `cari '${name}' di visible text -> ${pass}` }; } },
        ],
};
export default brief;
