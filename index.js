import { Client, GatewayIntentBits } from "discord.js";
import { config, validateConfig } from "./src/config.js";
import { createStore } from "./src/store.js";
import { logger } from "./src/logger.js";
import { handleCommand } from "./src/commands/index.js";

validateConfig();

const store = createStore(config.dataFile);
await store.load();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", readyClient => {
  logger.info("SUKUNA SOCIAL is online", {
    tag: readyClient.user.tag,
    guilds: readyClient.guilds.cache.size
  });
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;

  const body = message.content.slice(config.prefix.length).trim();
  if (!body) return;

  try {
    await handleCommand(message, body.split(/\s+/), store);
  } catch (error) {
    logger.error("Command handler failed", {
      command: body.split(/\s+/, 1)[0],
      guildId: message.guildId,
      error: error.message
    });
    await message.reply("That command could not be completed. Check the bot logs for details.").catch(() => {});
  }
});

client.on("error", error => logger.error("Discord client error", { error: error.message }));
process.on("unhandledRejection", error => {
  logger.error("Unhandled promise rejection", { error: error?.message || String(error) });
});

async function shutdown(signal) {
  logger.info("Shutting down SOCIAL bot", { signal });
  client.destroy();
  await store.flush().catch(error => logger.error("Could not flush storage", { error: error.message }));
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(config.token);
