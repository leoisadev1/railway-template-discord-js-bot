// Isolated CLI gateway/REST mock; never authenticates with Discord.
const { Client, DiscordjsError, DiscordjsErrorCodes, Events, REST } = require("discord.js");

Client.prototype.login = async function () {
  // discord.js turns Discord's 401 into this error (WebSocketManager#connect).
  if (process.env.TEST_PROVIDER_MODE === "invalid") throw new DiscordjsError(DiscordjsErrorCodes.TokenInvalid);
  if (process.env.TEST_PROVIDER_MODE === "outage") throw new Error("synthetic gateway outage");
  this.user = { id: "123", tag: "audit#0001" };
  this.isReady = () => true;
  this.emit(Events.ClientReady, this);
};
Client.prototype.destroy = async function () { this.isReady = () => false; };
REST.prototype.put = async function () { return []; };
