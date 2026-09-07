const fs = require("node:fs");
const path = require("node:path");
const { Collection } = require("discord.js");

function loadCommands() {
  const commands = new Collection();
  const dir = path.join(__dirname, "commands");
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".js"));

  for (const file of files) {
    const command = require(path.join(dir, file));
    if (!command?.data?.name || typeof command.execute !== "function") {
      console.warn(`Skipping ${file}: missing data.name or execute()`);
      continue;
    }
    commands.set(command.data.name, command);
  }

  return commands;
}

module.exports = { loadCommands };
