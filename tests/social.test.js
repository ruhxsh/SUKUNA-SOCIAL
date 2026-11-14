import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureProfile, recordInteraction, createRelationshipRequest,
  respondRelationshipRequest, removeRelationship, getAchievements
} from "../src/social.js";

test("profiles initialize with privacy, timestamps and statistics", () => {
  const guild = {};
  const profile = ensureProfile(guild, "user-1", "2026-01-01T00:00:00.000Z");
  assert.equal(profile.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(profile.visibility, "public");
  assert.deepEqual(profile.stats, { given: 0, received: 0, activity: 0 });
});

test("interactions update both members and award achievements", () => {
  const guild = {};
  recordInteraction(guild, "a", "b");
  assert.equal(guild.profiles.a.stats.given, 1);
  assert.equal(guild.profiles.b.stats.received, 1);
  assert.deepEqual(getAchievements(guild.profiles.a), ["First Connection"]);
});

test("relationship requests require an explicit acceptance", () => {
  const guild = {};
  createRelationshipRequest(guild, "a", "b");
  assert.equal(guild.profiles.a.relationships.length, 0);
  respondRelationshipRequest(guild, "b", "a", true);
  assert.deepEqual(guild.profiles.a.relationships, ["b"]);
  assert.deepEqual(guild.profiles.b.relationships, ["a"]);
  removeRelationship(guild, "a", "b");
  assert.deepEqual(guild.profiles.b.relationships, []);
});

test("private profile cannot send relationship requests", () => {
  const guild = {};
  ensureProfile(guild, "a").visibility = "private";
  assert.throws(() => createRelationshipRequest(guild, "a", "b"), /public profiles/);
});
