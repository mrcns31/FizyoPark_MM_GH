// Basit statik dosya sunucusu (bağımlılık yok)
// Çalıştır: node server.js

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
};

function safePath(urlPath) {
  const p = decodeURIComponent(urlPath);
  const cleaned = p.replaceAll("\\", "/");
  const resolved = path.normalize(path.join(ROOT, cleaned));
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-store", ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    let pathname = u.pathname || "/";
    if (pathname === "/") pathname = "/index.html";

    const filePath = safePath(pathname);
    if (!filePath) return send(res, 400, "Bad Request");

    fs.readFile(filePath, (err, data) => {
      if (err) return send(res, 404, "Not Found");
      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
    });
  } catch {
    send(res, 500, "Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  // stdout yeterli; log formatını sade tutuyoruz
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});

