import { PermissionsBitField } from "discord.js";
import { logger } from "../logger.js";
import {
  ensureProfile, recordInteraction, createRelationshipRequest,
  respondRelationshipRequest, removeRelationship, getAchievements
} from "../social.js";

const INTERACTIONS = {
  hug: "gave a hug to", highfive: "high-fived", pat: "gave a friendly pat to",
  wave: "waved to", compliment: "gave a compliment to", thank: "thanked"
};
const cooldowns = new Map();
const COOLDOWN_MS = 4000;

function cleanText(value, max) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function targetUser(message, required = true) {
  const user = message.mentions.users.first();
  if (!user && required) throw new Error("Mention a member to use this command.");
  if (user?.bot) throw new Error("Social features are for members, not bots.");
  return user;
}
function displayName(message, id) {
  return message.guild.members.cache.get(id)?.displayName || "Unknown member";
}
async function mutate(store, guildId, callback) {
  let result;
  await store.updateGuild(guildId, guild => { result = callback(guild); return guild; });
  return result;
}
async function showProfile(message, store, id) {
  const guild = store.getGuild(message.guildId);
  const profile = guild.profiles?.[id];
  if (!profile) return message.reply("That member has not created a profile yet. Use s profile create.");
  if (profile.visibility === "private" && id !== message.author.id) return message.reply("That member's profile is private.");
  const lines = [
    "**" + displayName(message, id) + "'s SOCIAL Profile**",
    "Bio: " + (profile.bio || "Not set"),
    profile.customInfo ? "About: " + profile.customInfo : null,
    "Created: " + new Date(profile.createdAt).toLocaleDateString("en-CA"),
    "Achievements: " + (getAchievements(profile).join(", ") || "None yet"),
    profile.statsVisibility === "public" || id === message.author.id
      ? "Interactions given: " + profile.stats.given + " | received: " + profile.stats.received
      : "Social statistics: Private",
    "Profile visibility: " + profile.visibility
  ].filter(Boolean);
  return message.reply(lines.join("\n"));
}

export async function handleCommand(message, args, store) {
  const command = (args.shift() || "").toLowerCase();
  const guildId = message.guildId;
  const userId = message.author.id;

  if (command === "help") return message.reply([
    "**SUKUNA SOCIAL commands**",
    "s profile [create|view [@member]|bio <text>|about <text>|reset|privacy public|private|stats public|private]",
    "s hug|highfive|pat|wave|compliment|thank @member",
    "s relationship request @member",
    "s relationship accept|decline @member",
    "s relationship status [@member]",
    "s relationship remove @member",
    "s socialstats [@member]",
    "s socialleaderboard [on|off] (Manage Server)",
    "s interaction add <name> <message> | remove <name> | list (Manage Server)",
    "Custom interactions are used as: s <name> @member"
  ].join("\n"));

  if (command === "profile") {
    const sub = (args.shift() || "view").toLowerCase();
    if (sub === "create") {
      const created = await mutate(store, guildId, guild => {
        const existed = Boolean(guild.profiles?.[userId]);
        ensureProfile(guild, userId);
        return !existed;
      });
      return message.reply(created ? "Your SOCIAL profile has been created." : "You already have a profile.");
    }
    if (sub === "view") {
      const target = targetUser(message, false);
      return showProfile(message, store, target?.id || userId);
    }
    if (sub === "bio" || sub === "about") {
      const value = cleanText(args.join(" "), 240);
      if (!value) throw new Error("Provide text to save.");
      await mutate(store, guildId, guild => {
        const profile = ensureProfile(guild, userId);
        profile[sub === "bio" ? "bio" : "customInfo"] = value;
      });
      return message.reply(sub === "bio" ? "Your bio was updated." : "Your profile information was updated.");
    }
    if (sub === "reset") {
      await mutate(store, guildId, guild => {
        const old = guild.profiles?.[userId];
        if (!old) throw new Error("You do not have a profile yet.");
        guild.profiles[userId] = {
          userId, bio: "", customInfo: "", createdAt: old.createdAt,
          visibility: "public", statsVisibility: "public", stats: old.stats,
          achievements: old.achievements, relationships: old.relationships
        };
      });
      return message.reply("Editable profile information and privacy settings were reset. Creation date, statistics, achievements and relationships were preserved.");
    }
    if (sub === "privacy" || sub === "stats") {
      const value = (args.shift() || "").toLowerCase();
      if (!["public", "private"].includes(value)) throw new Error("Choose public or private.");
      await mutate(store, guildId, guild => {
        ensureProfile(guild, userId)[sub === "privacy" ? "visibility" : "statsVisibility"] = value;
      });
      return message.reply((sub === "privacy" ? "Profile visibility" : "Statistics visibility") + " set to " + value + ".");
    }
    throw new Error("Unknown profile option. Use s help.");
  }

  if (Object.hasOwn(INTERACTIONS, command)) {
    const target = targetUser(message);
    if (target.id === userId) throw new Error("You cannot interact with yourself.");
    const key = guildId + ":" + userId;
    const now = Date.now();
    if (now - (cooldowns.get(key) || 0) < COOLDOWN_MS) throw new Error("Please wait a few seconds before another interaction.");
    await mutate(store, guildId, guild => recordInteraction(guild, userId, target.id));
    cooldowns.set(key, now);
    if (cooldowns.size > 5000) for (const [entry, time] of cooldowns) if (now - time > COOLDOWN_MS * 3) cooldowns.delete(entry);
    return message.reply("<@" + userId + "> " + INTERACTIONS[command] + " <@" + target.id + ">.");
  }

  if (command === "relationship") {
    const sub = (args.shift() || "").toLowerCase();
    if (sub === "request") {
      const target = targetUser(message);
      await mutate(store, guildId, guild => createRelationshipRequest(guild, userId, target.id));
      return message.reply("Relationship request sent to <@" + target.id + ">.");
    }
    if (sub === "accept" || sub === "decline") {
      const target = targetUser(message);
      await mutate(store, guildId, guild => respondRelationshipRequest(guild, userId, target.id, sub === "accept"));
      return message.reply(sub === "accept" ? "Relationship request accepted." : "Relationship request declined.");
    }
    if (sub === "remove") {
      const target = targetUser(message);
      await mutate(store, guildId, guild => removeRelationship(guild, userId, target.id));
      return message.reply("Relationship removed.");
    }
    if (sub === "status") {
      const target = targetUser(message, false);
      const id = target?.id || userId;
      const guild = store.getGuild(guildId);
      const profile = guild.profiles?.[id];
      if (!profile) return message.reply("No profile found for that member.");
      if (profile.visibility === "private" && id !== userId) return message.reply("That member's profile is private.");
      const names = (profile.relationships || []).map(otherId => displayName(message, otherId));
      const incoming = (guild.relationshipRequests || []).filter(item => item.to === id).length;
      const outgoing = (guild.relationshipRequests || []).filter(item => item.from === id).length;
      return message.reply("Relationships: " + (names.join(", ") || "None") + "\nPending incoming: " + incoming + " | outgoing: " + outgoing);
    }
    throw new Error("Use relationship request, accept, decline, status, or remove.");
  }

  if (command === "socialstats") {
    const target = targetUser(message, false);
    const id = target?.id || userId;
    const profile = store.getGuild(guildId).profiles?.[id];
    if (!profile) return message.reply("No profile found. Use s profile create.");
    if (profile.statsVisibility === "private" && id !== userId) return message.reply("That member's social statistics are private.");
    return message.reply("**" + displayName(message, id) + " — Social statistics**\nGiven: " + profile.stats.given + "\nReceived: " + profile.stats.received + "\nActivity: " + profile.stats.activity);
  }

  if (command === "interaction") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) throw new Error("You need Manage Server permission to configure custom interactions.");
    const sub = (args.shift() || "list").toLowerCase();
    if (sub === "list") {
      const entries = Object.entries(store.getGuild(guildId).customInteractions || {});
      return message.reply(entries.length ? "**Custom interactions**\\n" + entries.map(([name, text]) => name + " — " + text).join("\\n") : "No custom interactions are configured.");
    }
    const name = (args.shift() || "").toLowerCase();
    if (!/^[a-z][a-z0-9_-]{1,19}$/.test(name) || Object.hasOwn(INTERACTIONS, name) || ["help", "profile", "relationship", "socialstats", "socialleaderboard", "interaction"].includes(name)) throw new Error("Use a custom name of 2–20 letters, numbers, hyphens or underscores; it cannot replace a built-in command.");
    if (sub === "add") {
      const response = cleanText(args.join(" "), 180);
      if (!response) throw new Error("Provide a short friendly interaction message.");
      await mutate(store, guildId, guild => { guild.customInteractions ??= {}; guild.customInteractions[name] = response; });
      return message.reply("Custom interaction " + name + " was saved.");
    }
    if (sub === "remove") {
      const removed = await mutate(store, guildId, guild => { if (!guild.customInteractions?.[name]) return false; delete guild.customInteractions[name]; return true; });
      return message.reply(removed ? "Custom interaction removed." : "That custom interaction was not found.");
    }
    throw new Error("Use interaction add, remove, or list.");
  }

  if (command === "socialleaderboard") {
    const toggle = (args[0] || "").toLowerCase();
    if (toggle === "on" || toggle === "off") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) throw new Error("You need Manage Server permission to change this setting.");
      await mutate(store, guildId, guild => { guild.socialLeaderboardEnabled = toggle === "on"; });
      return message.reply("Social leaderboard " + (toggle === "on" ? "enabled." : "disabled."));
    }
    const guild = store.getGuild(guildId);
    if (guild.socialLeaderboardEnabled === false) return message.reply("The social leaderboard is disabled by a server administrator.");
    const rows = Object.values(guild.profiles || {})
      .filter(profile => profile.statsVisibility === "public")
      .sort((a, b) => (b.stats?.activity || 0) - (a.stats?.activity || 0))
      .slice(0, 10);
    if (!rows.length) return message.reply("There are no public social statistics to rank yet.");
    return message.reply("**SOCIAL activity leaderboard**\\n" + rows.map((profile, i) =>
      (i + 1) + ". " + displayName(message, profile.userId) + " — " + (profile.stats?.activity || 0) + " activity"
    ).join("\\n"));
  }

  const customText = store.getGuild(guildId).customInteractions?.[command];
  if (customText) {
    const target = targetUser(message);
    if (target.id === userId) throw new Error("You cannot interact with yourself.");
    const key = guildId + ":" + userId;
    const now = Date.now();
    if (now - (cooldowns.get(key) || 0) < COOLDOWN_MS) throw new Error("Please wait a few seconds before another interaction.");
    await mutate(store, guildId, guild => recordInteraction(guild, userId, target.id));
    cooldowns.set(key, now);
    const rendered = customText.replaceAll("{actor}", message.author.username).replaceAll("{target}", target.username);
    return message.reply({ content: rendered, allowedMentions: { parse: [] } });
  }
  logger.warn("Unknown SOCIAL command", { guildId, command: command || "(empty)", userId });
  return message.reply("Unknown command. Use s help.");
}
