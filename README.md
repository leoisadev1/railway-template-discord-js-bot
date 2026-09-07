# Discord.js Bot

A **current discord.js v14** slash-command worker for Railway. JavaScript first, Node 20+, `package-lock.json` committed, no dummy marketing homepage.

This listing replaces rotting marketplace clones such as [railwayapp-templates/discordjs](https://github.com/railwayapp-templates/discordjs) (`discord.js ^13.6.0`, September 2022, health 0). The image is pinned, slash commands register on boot, and Railway healthchecks hit `/health` so a bad token cannot take the deploy down.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/discord-js-bot)

## What you get

- **discord.js 14.27.0** (current stable; v15 is still pre-release)
- **Node 22.23.2 Alpine**, engines `>=20`
- Slash-command scaffold: drop a file in `src/commands/` (`/ping`, `/help` included)
- Worker process with a tiny `/health` JSON endpoint for Railway healthchecks
- Required `DISCORD_TOKEN` (you paste a real bot token; nothing is generated)

## One-click deploy

1. Click **Deploy on Railway**.
2. Paste your Discord bot token into **DISCORD_TOKEN** (required).
3. Deploy. Railway builds the Dockerfile, starts the worker, and waits for `/health` → `200`.
4. Invite the bot to a server (see below). Slash commands appear after the first successful login.

No volume. No extra services. One worker.

## Variables

| Name | Required | Generated | Notes |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | **yes** | no | Bot token from the Discord Developer Portal. Empty on this template — you must supply it. |
| `PORT` | no | Railway injects | Local healthcheck listen port. Do not override unless you know you need to. |

There are no generated secrets. Do not bake a dummy token into the service.

## Ports, volumes, health

| | |
| --- | --- |
| Public HTTP | Not required. This is a Discord gateway worker, not a website. |
| Healthcheck | `GET /health` on `PORT` (Railway-internal). JSON `{ ok: true, discord, ready, commands }`. Always `200` once the process is up, even if Discord login is still pending or the token is wrong. |
| Volume | None |
| Restart | On failure, up to 10 retries |

A public domain is optional and only useful if you want to curl `/health` yourself.

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
