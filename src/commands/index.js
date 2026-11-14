import { logger } from "../logger.js";

export async function handleCommand(message, args) {
  const command = (args.shift() || "").toLowerCase();

  if (command === "help") {
    return message.reply(
      "**SUKUNA SOCIAL**\n" +
      "The bot foundation is online. Social features will be added after their specifications are finalized."
    );
  }

  logger.warn("Unknown SOCIAL command", {
    guildId: message.guildId,
    command: command || "(empty)",
    userId: message.author.id
  });
  return message.reply("Unknown command. Use s help.");
}
