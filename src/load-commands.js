const fs = require("node:fs");
const path = require("node:path");
const { Collection } = require("discord.js");

function loadCommands() {
  const commands = new Collection();
  const dir = path.join(__dirname, "commands");
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".js"));

  for (const file of files) {
    const command = require(path.join(dir, file));
    if (!command?.data?.name || typeof command.data.toJSON !== "function" || typeof command.execute !== "function") {
      throw new Error(`Invalid command ${file}: expected data.toJSON() and execute()`);
    }
    if (commands.has(command.data.name)) {
      throw new Error(`Duplicate command: ${command.data.name}`);
    }
    command.data.toJSON();
    commands.set(command.data.name, command);
  }

  return commands;
}

module.exports = { loadCommands };
