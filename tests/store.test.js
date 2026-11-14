import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../src/store.js";

test("store creates a data file and persists guild updates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sukuna-social-"));
  const file = join(directory, "data.json");
  try {
    const store = createStore(file);
    await store.load();
    await store.updateGuild("12345678901234567", current => ({
      ...current,
      sampleSetting: true
    }));
    const saved = JSON.parse(await readFile(file, "utf8"));
    assert.equal(saved.guilds["12345678901234567"].sampleSetting, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("store returns copies rather than exposing internal state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sukuna-social-"));
  try {
    const store = createStore(join(directory, "data.json"));
    await store.load();
    await store.updateGuild("12345678901234567", () => ({ nested: { enabled: true } }));
    const copy = store.getGuild("12345678901234567");
    copy.nested.enabled = false;
    assert.equal(store.getGuild("12345678901234567").nested.enabled, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("store rejects invalid guild IDs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sukuna-social-"));
  try {
    const store = createStore(join(directory, "data.json"));
    await store.load();
    await assert.rejects(
      store.updateGuild("not-a-guild-id", () => ({})),
      TypeError
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
