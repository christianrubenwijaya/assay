import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, normalize, extname } from "node:path";

const MIME: Record<string,string> = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".wasm":"application/wasm" };

export async function startServer(root: string): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    let p = normalize(decodeURIComponent((req.url || "/").split("?")[0]));
    if (p.endsWith("/")) p += "index.html";
    const f = join(root, p);
    if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) { res.statusCode = 404; return res.end("404"); }
    res.setHeader("Content-Type", MIME[extname(f)] || "application/octet-stream");
    res.end(readFileSync(f));
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}
