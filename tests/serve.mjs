// Minimal static server for tests and screenshots (no deps). serve(rootDir) -> {url, close}
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".txt": "text/plain", ".css": "text/css", ".mp4": "video/mp4" };
export function serve(root) {
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = normalize(join(root, p));
    if (!f.startsWith(normalize(root))) { res.writeHead(403); return res.end(); }
    try { const b = await readFile(f); res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(b); }
    catch { res.writeHead(404); res.end("not found"); }
  });
  return new Promise(ok => srv.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() })));
}
