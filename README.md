# Deploy and Host Discord.js Bot on Railway

A **current discord.js v14** slash-command worker. JavaScript first, Node 20+, `package-lock.json` committed, no dummy marketing homepage.

This listing replaces rotting marketplace clones such as [railwayapp-templates/discordjs](https://github.com/railwayapp-templates/discordjs) (`discord.js ^13.6.0`, September 2022, health 0). The image is pinned, slash commands register on boot, and Railway healthchecks hit `/health` so a bad token cannot take the deploy down.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/discordjs-bot)

Source: [leoisadev1/railway-template-discord-js-bot](https://github.com/leoisadev1/railway-template-discord-js-bot)

## About Hosting Discord.js Bot

Railway runs a single worker that logs into the Discord gateway and serves a tiny `/health` JSON endpoint for deploys. There is no public website to configure. Paste `DISCORD_TOKEN` at deploy time, invite the bot, and slash commands (`/ping`, `/help`) register on `ClientReady`.

### What you get

- **discord.js 14.27.0** (current stable; v15 is still pre-release)
- **Node 22.23.2 Alpine**, engines `>=20`
- Slash-command scaffold: drop a file in `src/commands/`
- Worker process with `/health` for Railway healthchecks
- Required `DISCORD_TOKEN` (you paste a real bot token; nothing is generated)

## Why Deploy Discord.js Bot on Railway?

Railway keeps the gateway worker running, injects `PORT` for healthchecks, and rebuilds from the pinned Dockerfile when you push. You do not manage Node, Docker, or a VPS. Vertical scaling is one click if the bot grows.

Rotting clones die on invalid tokens and ship discord.js 13. This template stays `SUCCESS` via `/health`, pins 14.27.0, and treats `DISCORD_TOKEN` as a required secret.

## Common Use Cases

- One-click slash-command Discord bot for a community server
- Starter for moderation, welcome, or utility commands in JavaScript
- Always-on discord.js worker without a dummy HTTP marketing site

## Dependencies for Discord.js Bot Hosting

### Deployment Dependencies

- A [Discord application](https://discord.com/developers/applications) with a **Bot** token
- OAuth2 invite with scopes `bot` and `applications.commands`
- No volume, no database, no extra Railway services

### Variables

| Name | Required | Generated | Notes |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | **yes** | no | Bot token from the Discord Developer Portal. Empty on this template — you must supply it. |
| `PORT` | no | Railway injects | Local healthcheck listen port. Do not override unless you know you need to. |

There are no generated secrets. Do not bake a dummy token into the service.

### Ports, volumes, health

| | |
| --- | --- |
| Public HTTP | Not required. This is a Discord gateway worker, not a website. |
| Healthcheck | `GET /health` on `PORT` (Railway-internal). JSON `{ ok: true, discord, ready, commands }`. Always `200` once the process is up, even if Discord login is still pending or the token is wrong. |
| Volume | None |
| Restart | On failure, up to 10 retries |

A public domain is optional and only useful if you want to curl `/health` yourself.

## One-click deploy

1. Click **Deploy on Railway**.
2. Paste your Discord bot token into **DISCORD_TOKEN** (required).
3. Deploy. Railway builds the Dockerfile, starts the worker, and waits for `/health` → `200`.
4. Invite the bot to a server (see below). Slash commands appear after the first successful login.

## Create a bot token and invite it

1. Open [Discord Developer Portal → Applications](https://discord.com/developers/applications) and create an application.
2. **Bot** → **Reset Token** → copy into Railway `DISCORD_TOKEN`.
3. **Bot** → enable **Privileged Gateway Intents** only if you add message-content features later. This starter uses `Guilds` only.
4. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`. Copy the URL and open it to invite the bot.
5. Redeploy or wait for the running worker to log in. `/ping` and `/help` register as global application commands (can take a minute to show in Discord).

## Add a slash command

Create `src/commands/echo.js`:

```js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("echo")
    .setDescription("Repeats your text.")
    .addStringOption((option) =>
      option.setName("text").setDescription("What to say").setRequired(true),
    ),
  async execute(interaction) {
    await interaction.reply(interaction.options.getString("text", true));
  },
};
```

Redeploy. Commands in `src/commands/` are loaded and registered on `ClientReady`.

## Local run

```bash
cp .env.example .env   # set DISCORD_TOKEN
npm ci
npm start
```

`GET http://127.0.0.1:3000/health` should return `200`.

## Why this is healthier than the 2022 clones

| | This template | railwayapp-templates/discordjs (jX0xQo) |
| --- | --- | --- |
| discord.js | **14.27.0** pinned | `^13.6.0` (Sep 2022) |
| Lockfile | **package-lock.json** | yarn.lock, stale |
| Node | **22** (engines ≥20) | ≥16.6 |
| Slash commands | v10 REST, `SlashCommandBuilder` | API v9 / builders 0.12 |
| Healthcheck | `/health` + railway.toml | none (health 0) |
| Token | required, empty default | empty token, process often dies |
| Surface | worker | dummy HTTP service domain |

Pin the Docker tag, keep the lockfile, and treat `DISCORD_TOKEN` as a required secret.
