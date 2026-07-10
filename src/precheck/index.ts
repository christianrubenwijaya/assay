import { readManifest } from "../gates/manifest.js";
import { buildSubmission } from "../gates/build.js";
const dir = process.argv[2] || ".";
const m = readManifest(dir);
if (!m.ok) { console.error("❌ arena.json:", m.error); process.exit(1); }
const b = buildSubmission(dir, m.manifest!);
console.log(b.ok ? "✅ precheck OK — build jalan + dist/index.html ada. Aman submit." : "❌ build gagal:\n" + b.log);
process.exit(b.ok ? 0 : 1);
