// Isolated CLI gateway/REST mock; never authenticates with Discord.
const { Client, Events, REST } = require("discord.js");

Client.prototype.login = async function () {
  if (process.env.TEST_PROVIDER_MODE === "invalid") throw new Error("401 synthetic provider rejection");
  this.user = { id: "123", tag: "audit#0001" };
  this.isReady = () => true;
  this.emit(Events.ClientReady, this);
};
Client.prototype.destroy = async function () { this.isReady = () => false; };
REST.prototype.put = async function () { return []; };
