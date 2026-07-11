// Orkestrasi live event: trigger + poll N judge run lewat GitHub Actions REST API,
// tarik score.json dari tiap artifact, cetak leaderboard.
//
// KENAPA INI PERLU: judge.yml cuma "workflow_dispatch" -- 1 klik/1 API call = 1 peserta.
// Buat 50 peserta di window 1 jam, itu 50 kali trigger manual di GitHub UI (lambat,
// gampang salah ketik seed/repo url) + 50 kali buka Discord/Actions tab buat liat udah
// kelar apa belum. Script ini otomatisin: baca roster (siapa + repo + brief + seed),
// trigger semua run lewat API, polling status tiap run, tarik score.json pas selesai,
// cetak 1 leaderboard di akhir. Host cuma perlu siapin roster.json (+ seeds.json dari
// `npm run assign-seeds`) lalu jalanin 1 command ini.
//
// BELUM PERNAH DITES LAWAN GITHUB BENERAN (sandbox ini nggak punya token/akses repo lo)
// -- review isinya, coba dulu lawan 2-3 peserta dummy sebelum dipercaya buat 50 peserta
// beneran. Kalau ada yang meleset (nama field API GitHub berubah dll), error message
// bakal keliatan jelas di console, bukan gagal diam-diam -- tapi tetep, VERIFIKASI DULU.
//
// Usage:
//   set GH_TOKEN=ghp_xxx   (PAT dengan scope "repo" + "workflow", atau fine-grained: Actions: Read & Write)
//   npx tsx scripts/run_tournament.ts --owner christianrubenwijaya --repo assay \
//     --roster out/roster.json --seeds out/seeds.json --division open --track casual \
//     --concurrency 5 --delay-ms 1500 --poll-ms 8000 --timeout-ms 600000
//
// roster.json: [{ "participant": "alice", "repo": "https://github.com/alice/assay-sub" }, ...]
// seeds.json: hasil `npm run assign-seeds` -- { "alice": {...seed...}, ... }. Brief HARUS
// sama buat semua entri di 1 run script ini (1 Sortie = 1 brief); ulang script per brief
// kalau Jam pakai multi-brief.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { platform } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

interface RosterEntry { participant: string; repo: string; }
interface RunState {
  participant: string; repo: string; seed: any;
  dispatchedAt: string; runId?: number; status?: string; conclusion?: string;
  score?: number; ratable?: boolean; flags?: string[]; error?: string;
}

function ghFetch(token: string, url: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers || {}),
    },
  });
}

async function dispatch(token: string, owner: string, repo: string, briefId: string, s: RunState, division: string, track: string) {
  const res = await ghFetch(token, `https://api.github.com/repos/${owner}/${repo}/actions/workflows/judge.yml/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: "main",
      inputs: {
        submission: s.repo, participant: s.participant, brief: briefId,
        seed: JSON.stringify(s.seed), division, track,
      },
    }),
  });
  if (!res.ok) throw new Error(`dispatch ${s.participant} gagal: ${res.status} ${await res.text()}`);
}

// judge.yml punya `run-name: judge-${{ inputs.participant }}` -- itu yang dipake buat
// nyocokin run mana yg punya peserta mana (workflow_dispatch API gak balikin run_id
// langsung pas trigger, jadi ini cara paling reliable buat matching).
async function findRun(token: string, owner: string, repo: string, participant: string, sinceIso: string): Promise<any | null> {
  const res = await ghFetch(token, `https://api.github.com/repos/${owner}/${repo}/actions/runs?event=workflow_dispatch&per_page=50`);
  if (!res.ok) return null;
  const data: any = await res.json();
  const runs = (data.workflow_runs || []).filter((r: any) => r.name === `judge-${participant}` && r.created_at >= sinceIso);
  return runs[0] || null;
}

async function pollRun(token: string, owner: string, repo: string, s: RunState, pollMs: number, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!s.runId) {
      const run = await findRun(token, owner, repo, s.participant, s.dispatchedAt);
      if (run) { s.runId = run.id; s.status = run.status; s.conclusion = run.conclusion; }
    } else {
      const res = await ghFetch(token, `https://api.github.com/repos/${owner}/${repo}/actions/runs/${s.runId}`);
      if (res.ok) { const r: any = await res.json(); s.status = r.status; s.conclusion = r.conclusion; }
    }
    if (s.status === "completed") return;
    await new Promise(r => setTimeout(r, pollMs));
  }
  s.error = "timeout nunggu run selesai";
}

function extractZip(zipPath: string, destDir: string) {
  mkdirSync(destDir, { recursive: true });
  if (platform() === "win32") {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: "pipe" });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "pipe" });
  }
}

async function fetchScore(token: string, owner: string, repo: string, s: RunState, outDir: string) {
  if (!s.runId) { s.error = "runId gak ketemu, gak bisa tarik artifact"; return; }
  const res = await ghFetch(token, `https://api.github.com/repos/${owner}/${repo}/actions/runs/${s.runId}/artifacts`);
  if (!res.ok) { s.error = `list artifact gagal: ${res.status}`; return; }
  const data: any = await res.json();
  const art = (data.artifacts || []).find((a: any) => a.name === `assay-result-${s.participant}`);
  if (!art) { s.error = "artifact assay-result-<participant> gak ketemu (run mungkin gagal sebelum upload)"; return; }
  const dl = await ghFetch(token, `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${art.id}/zip`);
  if (!dl.ok) { s.error = `download artifact gagal: ${dl.status}`; return; }
  const buf = Buffer.from(await dl.arrayBuffer());
  const zipPath = join(outDir, `${s.participant}.zip`);
  writeFileSync(zipPath, buf);
  const dest = join(outDir, s.participant);
  extractZip(zipPath, dest);
  const scorePath = join(dest, s.participant, "score.json");
  const scorePathAlt = join(dest, "score.json");
  const p = existsSync(scorePath) ? scorePath : scorePathAlt;
  if (!existsSync(p)) { s.error = `score.json gak ketemu di artifact (cek struktur out/ di judge.yml)`; return; }
  const r = JSON.parse(readFileSync(p, "utf8"));
  s.score = r.score; s.ratable = r.ratable; s.flags = r.flags;
}

async function worker(queue: RunState[], concurrency: number, fn: (s: RunState) => Promise<void>) {
  let i = 0;
  async function run() { while (i < queue.length) { const s = queue[i++]; await fn(s); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, run));
}

async function main() {
  const a: any = Object.fromEntries(process.argv.slice(2).reduce((acc: string[][], v, i, arr) => { if (v.startsWith("--")) acc.push([v.slice(2), arr[i + 1]]); return acc; }, []));
  const token = process.env.GH_TOKEN;
  if (!token) { console.error("GH_TOKEN env var wajib diset (PAT scope repo+workflow)."); process.exit(1); }
  const { owner, repo, roster, seeds, brief } = a;
  if (!owner || !repo || !roster || !seeds || !brief) {
    console.error("Wajib: --owner --repo --roster out/roster.json --seeds out/seeds.json --brief <id>");
    process.exit(1);
  }
  const division = a.division || "open", track = a.track || "casual";
  const concurrency = Number(a["concurrency"] || 5);
  const delayMs = Number(a["delay-ms"] || 1500);
  const pollMs = Number(a["poll-ms"] || 8000);
  const timeoutMs = Number(a["timeout-ms"] || 600000);
  const outDir = resolve(ROOT, "out", "_tournament");
  mkdirSync(outDir, { recursive: true });

  const rosterList: RosterEntry[] = JSON.parse(readFileSync(roster, "utf8"));
  const seedMap: Record<string, any> = JSON.parse(readFileSync(seeds, "utf8"));
  const states: RunState[] = rosterList.map(r => ({ participant: r.participant, repo: r.repo, seed: seedMap[r.participant], dispatchedAt: "" }));
  const missingSeed = states.filter(s => !s.seed);
  if (missingSeed.length) { console.error(`${missingSeed.length} peserta di roster gak punya seed di seeds.json: ${missingSeed.map(s => s.participant).join(", ")}`); process.exit(1); }

  console.log(`[tournament] dispatch ${states.length} peserta, brief=${brief}, concurrency=${concurrency}...`);
  for (const s of states) {
    s.dispatchedAt = new Date().toISOString();
    try { await dispatch(token, owner, repo, brief, s, division, track); console.log(`  dispatched: ${s.participant}`); }
    catch (e: any) { s.error = e.message; console.error(`  FAILED dispatch ${s.participant}: ${e.message}`); }
    await new Promise(r => setTimeout(r, delayMs)); // hindari secondary rate limit GitHub
  }

  console.log(`[tournament] polling ${states.length} run (poll tiap ${pollMs}ms, timeout ${timeoutMs}ms/run)...`);
  await worker(states.filter(s => !s.error), concurrency, async (s) => { await pollRun(token, owner, repo, s, pollMs, timeoutMs); });

  console.log(`[tournament] tarik score.json dari artifact...`);
  await worker(states.filter(s => !s.error && s.status === "completed"), concurrency, async (s) => { await fetchScore(token, owner, repo, s, outDir); });

  states.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  console.log(`\n[tournament] LEADERBOARD (brief=${brief})`);
  console.log("rank | participant | score | ratable | conclusion | flags/error");
  states.forEach((s, i) => {
    console.log(`${String(i + 1).padStart(4)} | ${s.participant.padEnd(20)} | ${String(s.score ?? "-").padStart(5)} | ${String(s.ratable ?? "-").padEnd(7)} | ${(s.conclusion ?? s.status ?? "-").padEnd(10)} | ${s.error ?? (s.flags || []).join(",")}`);
  });

  const resultsPath = join(outDir, "results.json");
  writeFileSync(resultsPath, JSON.stringify(states, null, 2));
  console.log(`\n[tournament] hasil lengkap ditulis ke ${resultsPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
