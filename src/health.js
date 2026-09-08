const http = require("node:http");

function createHealthServer(getStatus) {
  return http.createServer((req, res) => {
    const path = req.url?.split("?")[0] || "/";
    if (req.method !== "GET" || !["/", "/health", "/healthz", "/ready", "/live"].includes(path)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    const status = getStatus();
    const ok = path === "/live" ? status.live : status.ready;
    const body = JSON.stringify({ ...status, ok, service: "discord-js-bot" });
    res.writeHead(ok ? 200 : 503, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(body),
    });
    res.end(body);
  });
}

module.exports = { createHealthServer };
