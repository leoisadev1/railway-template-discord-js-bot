const {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} = require("discord.js");
const { loadCommands } = require("./load-commands");
const { startHealthServer } = require("./health");

const token = (process.env.DISCORD_TOKEN || "").trim();
const commands = loadCommands();

let discordStatus = token ? "connecting" : "missing_token";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});
client.commands = commands;

startHealthServer(() => ({
  discord: discordStatus,
  ready: Boolean(client.isReady()),
  commands: commands.size,
}));

process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection:", err);
});

client.once(Events.ClientReady, async (readyClient) => {
  discordStatus = "ready";
  console.log(`Logged in as ${readyClient.user.tag}`);

  const body = [...commands.values()].map((command) => command.data.toJSON());
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    await rest.put(Routes.applicationCommands(readyClient.user.id), { body });
    console.log(`Registered ${body.length} application slash command(s)`);
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Command /${interaction.commandName} failed:`, err);
    const payload = {
      content: "There was an error while executing this command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.on(Events.Error, (err) => {
  console.error("Discord client error:", err);
});

client.on(Events.ShardDisconnect, () => {
  if (discordStatus === "ready") discordStatus = "disconnected";
});

async function connectDiscord() {
  if (!token) {
    console.warn(
      "DISCORD_TOKEN is missing. Healthcheck stays up; set the token to log in.",
    );
    return;
  }

  try {
    await client.login(token);
  } catch (err) {
    discordStatus = "login_failed";
    console.error(
      "Discord login failed (process stays up for healthcheck):",
      err?.message || err,
    );
  }
}

connectDiscord();
