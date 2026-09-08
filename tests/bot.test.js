const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter, once } = require("node:events");
const { spawn } = require("node:child_process");
const { Events, MessageFlags } = require("discord.js");
const { createBot, handleInteraction } = require("../src/index");
const { loadCommands } = require("../src/load-commands");

const host = process.env.TEST_HOST || "127.0.0.1";
const logger = { log() {}, error() {} };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
class FakeClient extends EventEmitter {
  user = { id: "123", tag: "audit#0001" };
  ready = false;
  destroyed = 0;
  isReady() { return this.ready; }
  async login() { this.ready = true; this.emit(Events.ClientReady, this); }
  async destroy() { this.ready = false; this.destroyed++; }
}
function fixture(t, options = {}) {
  const client = new FakeClient();
  const puts = [];
  const rest = { setToken() { return this; }, async put(route, data) { puts.push({ route, ...data }); } };
  const app = createBot({ token: "synthetic-test-token", host, port: 0, client, rest, logger, ...options });
  t.after(() => app.stop());
  return { app, client, puts, rest };
}
async function request(app, path = "/health", method = "GET") {
  const response = await fetch(`http://${host}:${app.server.address().port}${path}`, { method });
  const text = await response.text();
  return { status: response.status, body: text.startsWith("{") ? JSON.parse(text) : text };
}
function interaction(name, extra = {}) {
  const replies = [];
  return { commandName: name, isChatInputCommand: () => true, replies,
    client: { ws: { ping: 42 }, commands: loadCommands() },
    reply: async (payload) => replies.push(payload), ...extra };
}

test("all command definitions serialize and /ping and /help execute", async () => {
  const commands = loadCommands();
  assert.deepEqual([...commands.keys()].sort(), ["help", "ping"]);
  for (const command of commands.values()) assert.ok(command.data.toJSON().description);
  const ping = interaction("ping");
  await handleInteraction(ping, commands, logger);
  assert.match(ping.replies[0].content, /Pong.*42ms/);
  const help = interaction("help");
  await handleInteraction(help, commands, logger);
  assert.match(help.replies[0].content, /\/ping/);
  assert.match(help.replies[0].content, /\/help/);
  const unknown = interaction("unknown");
  await handleInteraction(unknown, commands, logger);
  await handleInteraction(interaction("ping", { isChatInputCommand: () => false }), commands, logger);
  assert.equal(unknown.replies.length, 0);
});

test("handler errors reply ephemerally before and after acknowledgement, including a failed error reply", async () => {
  const commands = new Map([["fail", { execute: async () => { throw new Error("synthetic failure"); } }]]);
  for (const extra of [{}, { replied: true }, { deferred: true }]) {
    const followups = [];
    const ctx = interaction("fail", { ...extra, followUp: async (payload) => followups.push(payload) });
    await handleInteraction(ctx, commands, logger);
    const payload = [...ctx.replies, ...followups][0];
    assert.equal(payload.flags, MessageFlags.Ephemeral);
    assert.match(payload.content, /error/);
    assert.equal(followups.length, extra.replied || extra.deferred ? 1 : 0);
  }
  await handleInteraction(interaction("fail", { reply: async () => { throw new Error("expired"); } }), commands, logger);
});

test("readiness waits for BOTH gateway and command registration, with independent liveness", async (t) => {
  const { app, client, puts, rest } = fixture(t);
  const gate = deferred();
  const registering = deferred();
  rest.put = async (route, data) => { puts.push({ route, ...data }); registering.resolve(); await gate.promise; };
  const start = app.start();
  await registering.promise;
  t.diagnostic(`Temporary health listener: ${host}:${app.server.address().port}`);
  assert.equal((await request(app)).status, 503);
  assert.equal((await request(app, "/live")).status, 200);
  assert.equal((await request(app)).body.commandsRegistered, false);
  gate.resolve();
  await start;
  assert.equal((await request(app)).status, 200);
  assert.equal(puts[0].route, "/applications/123/commands");
  assert.deepEqual(puts[0].body.map((command) => command.name).sort(), ["help", "ping"]);
  for (const path of ["/", "/healthz", "/ready?probe=1"]) assert.equal((await request(app, path)).status, 200);
  assert.equal((await request(app, "/health", "POST")).status, 404);
  assert.equal((await request(app, "/interactions", "POST")).status, 404);
  assert.equal((await request(app, "/webhook", "POST")).status, 404);
  client.emit(Events.ShardDisconnect, {}, 0);
  assert.equal((await request(app)).status, 503);
  client.emit(Events.ShardResume, 0);
  assert.equal((await request(app)).status, 200);
  client.emit(Events.ShardReconnecting, 0);
  assert.equal((await request(app)).status, 503);
  client.emit(Events.ShardReady, 0);
  assert.equal((await request(app)).status, 200);
  client.ready = false;
  assert.equal((await request(app)).status, 503);
  await app.stop();
  await app.stop();
  assert.equal(client.destroyed, 1);
  assert.equal(app.server.listening, false);
  assert.equal(app.status().ready, false);
  assert.equal(app.status().live, false);
});

test("missing token fails without opening HTTP or logging in", async (t) => {
  const { app, client } = fixture(t, { token: "   " });
  client.login = async () => assert.fail("login must not run");
  await assert.rejects(app.start(), /DISCORD_TOKEN is required/);
  assert.equal(app.server.listening, false);
});

test("rejected credentials, failed registration and gateway timeout cannot be green", async (t) => {
  for (const failure of ["login", "registration", "timeout"]) {
    const { app, client, rest } = fixture(t, { startupTimeoutMs: 25 });
    if (failure === "login") client.login = async () => { throw new Error("401 synthetic"); };
    if (failure === "registration") rest.put = async () => { throw new Error("403 synthetic"); };
    if (failure === "timeout") client.login = async () => {};
    await assert.rejects(app.start(), failure === "registration" ? /registration failed/ : /login\/readiness failed/);
    assert.equal(app.status().ready, false);
    assert.equal(app.server.listening, false);
    assert.equal(client.destroyed, 1);
  }
});

test("HTTP bind failure closes the gateway client", async (t) => {
  const owner = fixture(t).app;
  await owner.start();
  const { app, client } = fixture(t, { port: owner.server.address().port });
  await assert.rejects(app.start(), /EADDRINUSE/);
  assert.equal(client.destroyed, 1);
});

test("shutdown during startup aborts the readiness wait", async (t) => {
  const { app, client } = fixture(t);
  const loggingIn = deferred();
  client.login = async () => { loggingIn.resolve(); };
  const start = app.start();
  const rejected = assert.rejects(start, /login\/readiness failed/);
  await loggingIn.promise;
  await app.stop();
  await rejected;
  assert.equal(client.listenerCount(Events.ClientReady), 0);
});

test("gateway interaction events dispatch the actual command handler", async (t) => {
  const { app, client } = fixture(t);
  await app.start();
  const replied = deferred();
  client.emit(Events.InteractionCreate, interaction("ping", { reply: async (payload) => replied.resolve(payload) }));
  assert.match((await replied.promise).content, /Pong/);
});

test("shutdown cancels a stuck command registration without waiting for the startup deadline", async (t) => {
  const { app, rest } = fixture(t);
  const registering = deferred();
  let signal;
  rest.put = async (_route, data) => { signal = data.signal; registering.resolve(); await new Promise(() => {}); };
  const start = app.start();
  const rejected = assert.rejects(start, /registration failed/);
  await registering.promise;
  await app.stop();
  await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(app.status().ready, false);
});

test("invalid port fails closed and a stuck gateway shutdown has a deadline", async (t) => {
  const invalid = fixture(t, { port: NaN }).app;
  await assert.rejects(invalid.start(), /PORT must be/);
  const client = new FakeClient();
  const app = createBot({ token: "synthetic", client, host, port: 0, logger, shutdownTimeoutMs: 25,
    rest: { setToken() { return this; }, async put() {} } });
  t.after(() => { app.server.closeAllConnections(); app.server.close(); });
  await app.start();
  client.destroy = async () => new Promise(() => {});
  await assert.rejects(app.stop(), /shutdown timed out/);
  assert.equal(app.server.listening, false);
  assert.equal(app.status().live, false);
});

test("the loader rejects malformed and duplicate command modules", (t) => {
  const filename = require.resolve("../src/commands/help");
  const original = require.cache[filename].exports;
  t.after(() => { require.cache[filename].exports = original; });
  require.cache[filename].exports = { data: { name: "broken" }, execute() {} };
  assert.throws(loadCommands, /Invalid command/);
  require.cache[filename].exports = require("../src/commands/ping");
  assert.throws(loadCommands, /Duplicate command/);
});

async function childResult(args, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: require("node:path").join(__dirname, ".."),
    env: { PATH: process.env.PATH, HOST: host, PORT: "0", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (data) => output.push(data.toString()));
  child.stderr.on("data", (data) => output.push(data.toString()));
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  const [code, signal] = await once(child, "exit");
  clearTimeout(timer);
  return { code, signal, output: output.join("") };
}

test("real CLI exits nonzero for missing and mocked provider-rejected credentials", async () => {
  const missing = await childResult(["src/index.js"]);
  assert.equal(missing.code, 1);
  assert.match(missing.output, /DISCORD_TOKEN is required/);
  const invalid = await childResult(["--require", "./tests/provider.cjs", "src/index.js"], {
    DISCORD_TOKEN: "synthetic-invalid", TEST_PROVIDER_MODE: "invalid",
  });
  assert.equal(invalid.code, 1);
  assert.match(invalid.output, /login\/readiness failed/);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  test(`real CLI handles ${signal} and exits cleanly with a mocked gateway`, async (t) => {
    const child = spawn(process.execPath, ["--require", "./tests/provider.cjs", "src/index.js"], {
      cwd: require("node:path").join(__dirname, ".."),
      env: { PATH: process.env.PATH, HOST: host, PORT: "0", DISCORD_TOKEN: "synthetic-valid" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = once(child, "exit");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    t.after(() => { clearTimeout(timer); if (child.exitCode === null) child.kill("SIGKILL"); });
    child.stdout.on("data", (data) => { if (data.toString().includes("Registered 2")) child.kill(signal); });
    assert.deepEqual(await exited, [0, null]);
  });
}
