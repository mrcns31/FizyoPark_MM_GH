// Basit statik dosya sunucusu (bağımlılık yok)
// Çalıştır: node server.js

const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
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
  res.writeHead(status, { "Cache-Control": "no-store", Vary: "Accept-Encoding", ...headers });
  res.end(body);
}

const GZIP_EXTS = new Set([".html", ".js", ".css", ".json", ".svg"]);
const GZIP_MIN_BYTES = 512;

function sendFile(req, res, pathname, filePath, data) {
  const ext = path.extname(filePath).toLowerCase();
  const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
  if (pathname === "/sw.js" || pathname === "/manifest.json") {
    headers["Cache-Control"] = "no-cache";
  }
  if (pathname === "/manifest.json") {
    headers["Content-Type"] = "application/manifest+json; charset=utf-8";
  }
  const accept = String(req.headers["accept-encoding"] || "");
  if (GZIP_EXTS.has(ext) && accept.includes("gzip") && data.length >= GZIP_MIN_BYTES) {
    zlib.gzip(data, (gzipErr, compressed) => {
      if (gzipErr) return send(res, 200, data, headers);
      headers["Content-Encoding"] = "gzip";
      send(res, 200, compressed, headers);
    });
    return;
  }
  send(res, 200, data, headers);
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
      sendFile(req, res, pathname, filePath, data);
    });
  } catch {
    send(res, 500, "Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  // stdout yeterli; log formatını sade tutuyoruz
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});

