const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong and websocket latency."),
  async execute(interaction) {
    const latency = interaction.client.ws.ping;
    await interaction.reply({
      content: `Pong. Websocket ping: ${latency}ms`,
    });
  },
};
