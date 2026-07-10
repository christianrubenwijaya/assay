import type { Page } from "playwright";

export async function smokeCheck(page: Page, url: string, loadSeconds: number):
  Promise<{ ok: boolean; load_ms: number; fatal: number; detail: string }> {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const t0 = Date.now();
  let ok = true, detail = "";
  try { await page.goto(url, { waitUntil: "load", timeout: loadSeconds * 1000 + 3000 }); }
  catch (e: any) { ok = false; detail = "gagal load: " + e.message; }
  const load_ms = Date.now() - t0;
  await page.waitForTimeout(400);
  if (load_ms > loadSeconds * 1000) { ok = false; detail = `load ${load_ms}ms > ${loadSeconds}s`; }
  if (errors.length) { ok = false; detail += ` | console/page error: ${errors.length}`; }
  return { ok, load_ms, fatal: errors.length, detail: detail || "ok" };
}
