const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lists the bot's slash commands."),
  async execute(interaction) {
    const lines = [...interaction.client.commands.values()].map(
      (command) => `\`/${command.data.name}\` — ${command.data.description}`,
    );
    await interaction.reply({
      content: lines.length
        ? `Commands:\n${lines.join("\n")}`
        : "No commands loaded.",
    });
  },
};
