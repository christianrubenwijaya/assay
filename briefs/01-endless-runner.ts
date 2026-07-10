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
    { id: "seed", label: "Seed theme hadir di DOM (implementasi seed unik)", seed: true,
      run: async (p, seed) => {
        const theme = String(seed?.theme ?? "").toLowerCase();
        const body = (await p.evaluate(() => document.body.innerText + " " + document.body.outerHTML)).toLowerCase();
        const pass = theme.length > 0 && body.includes(theme);
        return { pass, detail: `cari '${theme}' di DOM → ${pass}` }; } },
  ],
};
export default brief;
