const http = require("node:http");

function startHealthServer(getStatus) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);

  const server = http.createServer((req, res) => {
    const url = req.url?.split("?")[0] || "/";
    if (url !== "/health" && url !== "/") {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const body = JSON.stringify({
      ok: true,
      service: "discord-js-bot",
      ...getStatus(),
    });
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(body);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Healthcheck listening on 0.0.0.0:${port}/health`);
  });

  return server;
}

module.exports = { startHealthServer };
