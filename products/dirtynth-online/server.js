const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 8080);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".map", "application/json; charset=utf-8"]
]);

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function listPresets(res) {
  const presetDir = path.join(root, "presets");
  fs.readdir(presetDir, { withFileTypes: true }, (err, entries) => {
    if (err) {
      if (err.code === "ENOENT") {
        send(res, 200, JSON.stringify({ files: [] }), "application/json; charset=utf-8");
      } else {
        send(res, 500, JSON.stringify({ error: "Preset scan failed" }), "application/json; charset=utf-8");
      }
      return;
    }

    const files = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    send(res, 200, JSON.stringify({ files }), "application/json; charset=utf-8");
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === "/presets.json") {
    listPresets(res);
    return;
  }

  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const file = path.resolve(root, `.${pathname}`);

  if (!file.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }

    send(res, 200, data, types.get(path.extname(file)) || "application/octet-stream");
  });
}).listen(port, () => {
  console.log(`Dirtynth WebTest: http://localhost:${port}`);
});
