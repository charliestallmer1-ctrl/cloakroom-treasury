// Tiny static file server for previewing the prototype locally.
// Usage: node server.mjs  (then open http://localhost:8099)
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Serve the folder this script lives in, regardless of the launch cwd.
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8099;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}`));
