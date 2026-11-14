import { randomUUID } from "node:crypto";

const ACHIEVEMENTS = [
  { id: "first_interaction", name: "First Connection", threshold: 1 },
  { id: "social_10", name: "Friendly Face", threshold: 10 },
  { id: "social_50", name: "Community Regular", threshold: 50 },
  { id: "social_100", name: "Social Butterfly", threshold: 100 }
];

export function ensureProfile(guild, userId, now = new Date().toISOString()) {
  guild.profiles ??= {};
  if (guild.profiles[userId]) return guild.profiles[userId];
  return guild.profiles[userId] = {
    userId, bio: "", customInfo: "", createdAt: now,
    visibility: "public", statsVisibility: "public",
    stats: { given: 0, received: 0, activity: 0 },
    achievements: [], relationships: []
  };
}

export function updateAchievements(profile) {
  const total = profile.stats.given + profile.stats.received;
  const earned = new Set(profile.achievements);
  for (const item of ACHIEVEMENTS) if (total >= item.threshold) earned.add(item.id);
  profile.achievements = [...earned];
}

export function recordInteraction(guild, actorId, targetId, now = new Date().toISOString()) {
  if (actorId === targetId) throw new Error("You cannot interact with yourself.");
  const actor = ensureProfile(guild, actorId, now);
  const target = ensureProfile(guild, targetId, now);
  actor.stats.given++;
  actor.stats.activity++;
  target.stats.received++;
  target.stats.activity++;
  updateAchievements(actor);
  updateAchievements(target);
  return { actor, target };
}

export function createRelationshipRequest(guild, requesterId, targetId, now = new Date().toISOString()) {
  if (requesterId === targetId) throw new Error("You cannot send a relationship request to yourself.");
  guild.relationshipRequests ??= [];
  const requester = ensureProfile(guild, requesterId, now);
  const target = ensureProfile(guild, targetId, now);
  if (requester.visibility === "private" || target.visibility === "private") {
    throw new Error("Both members must have public profiles to use relationship requests.");
  }
  if (guild.relationshipRequests.some(item =>
    (item.from === requesterId && item.to === targetId) ||
    (item.from === targetId && item.to === requesterId)
  )) throw new Error("A relationship request already exists between these members.");
  if (requester.relationships.includes(targetId)) throw new Error("You are already connected.");
  const request = { id: randomUUID(), from: requesterId, to: targetId, createdAt: now };
  guild.relationshipRequests.push(request);
  return request;
}

export function respondRelationshipRequest(guild, recipientId, requesterId, accept) {
  guild.relationshipRequests ??= [];
  const index = guild.relationshipRequests.findIndex(item => item.from === requesterId && item.to === recipientId);
  if (index < 0) throw new Error("No pending request from that member was found.");
  guild.relationshipRequests.splice(index, 1);
  if (accept) {
    const recipient = ensureProfile(guild, recipientId);
    const requester = ensureProfile(guild, requesterId);
    if (!recipient.relationships.includes(requesterId)) recipient.relationships.push(requesterId);
    if (!requester.relationships.includes(recipientId)) requester.relationships.push(recipientId);
  }
}

export function removeRelationship(guild, userId, otherId) {
  const profile = guild.profiles?.[userId];
  const other = guild.profiles?.[otherId];
  if (!profile?.relationships?.includes(otherId)) throw new Error("No relationship with that member was found.");
  profile.relationships = profile.relationships.filter(id => id !== otherId);
  if (other?.relationships) other.relationships = other.relationships.filter(id => id !== userId);
}

export function getAchievements(profile) {
  const earned = new Set(profile.achievements ?? []);
  return ACHIEVEMENTS.filter(item => earned.has(item.id)).map(item => item.name);
}
