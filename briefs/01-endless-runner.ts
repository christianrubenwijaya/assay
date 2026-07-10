import type { Brief } from "../src/checks/spec.js";

const brief: Brief = {
  id: "01-endless-runner",
  title: "One-button endless runner",
  checks: [
    { id: "canvas", label: "Canvas #game ada", seed: false,
      run: async (p) => { const n = await p.locator("canvas#game").count(); return { pass: n > 0, detail: `canvas#game=${n}` }; } },
    { id: "score", label: "#score menampilkan angka", seed: false,
      run: async (p) => { const t = (await p.locator("#score").first().textContent().catch(() => "")) || ""; return { pass: /\d/.test(t), detail: `#score='${t.trim()}'` }; } },
    { id: "hook", label: "window.__assay.start = function", seed: false,
      run: async (p) => { const ok = await p.evaluate(() => typeof (window as any).__assay?.start === "function"); return { pass: ok, detail: `hook=${ok}` }; } },
    { id: "gameover", label: "Game over muncul setelah collision", seed: false,
      run: async (p) => {
        const ok = await p.evaluate(async () => {
          const a = (window as any).__assay; if (!a?.simulateCollision) return false;
          a.simulateCollision(); await new Promise(r => setTimeout(r, 150));
          const el = document.querySelector("#gameover") as HTMLElement | null;
          return !!el && el.offsetParent !== null && !el.hasAttribute("hidden");
        });
        return { pass: ok, detail: `gameover_visible=${ok}` }; } },
    { id: "restart", label: "start() beneran reset skor (bukan cuma nempel)", seed: false,
      run: async (p) => {
        const r = await p.evaluate(async () => {
          const a = (window as any).__assay; if (!a?.start || typeof a.score !== "number" && a.score !== 0) { /* noop */ }
          if (!a?.start) return { before: -1, after: -1 };
          for (let i = 0; i < 5; i++) document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
          await new Promise(res => setTimeout(res, 60));
          const before = a.score;
          a.start();
          await new Promise(res => setTimeout(res, 60));
          const after = a.score;
          return { before, after };
        });
        const pass = r.before > 0 && r.after === 0;
        return { pass, detail: `skor_sebelum_restart=${r.before} skor_sesudah_restart=${r.after}` }; } },
    { id: "sustained_score", label: "Skor jalan terus, gak macet/hardcap dini", seed: false,
      run: async (p) => {
        const r = await p.evaluate(async () => {
          const a = (window as any).__assay; if (!a?.start) return { score: -1 };
          a.start();
          await new Promise(res => setTimeout(res, 60));
          for (let i = 0; i < 10; i++) document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
          await new Promise(res => setTimeout(res, 60));
          return { score: a.score };
        });
        const pass = r.score >= 8;
        return { pass, detail: `skor_setelah_10_tick=${r.score} (min 8)` }; } },
    { id: "seed", label: "Seed theme hadir di visible text (bukan script/comment)", seed: true,
      run: async (p, seed) => {
        const theme = String(seed?.theme ?? "").toLowerCase();
        // sengaja HANYA innerText (visible-rendered text), bukan outerHTML/script source --
        // outerHTML ikut nyerap komentar/string di dalam <script> yang gak pernah dirender,
        // jadi submission prebuilt bisa nge-fake lolos cukup nulis seed di komentar kode.
        const body = (await p.evaluate(() => document.body.innerText)).toLowerCase();
        const pass = theme.length > 0 && body.includes(theme);
        return { pass, detail: `cari '${theme}' di visible text -> ${pass}` }; } },
  ],
};
export default brief;
