import { mkdir, readFile, rename, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const EMPTY_STATE = () => ({ version: 1, guilds: {} });

function normalizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_STATE();
  if (!value.guilds || typeof value.guilds !== "object" || Array.isArray(value.guilds)) {
    return EMPTY_STATE();
  }
  return {
    version: 1,
    guilds: value.guilds
  };
}

export function createStore(filePath) {
  const target = resolve(filePath);
  let state = EMPTY_STATE();
  let writeQueue = Promise.resolve();

  async function persist() {
    const snapshot = JSON.stringify(state, null, 2);
    const directory = dirname(target);
    await mkdir(directory, { recursive: true });
    const temporary = target + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporary, snapshot, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, target);
    } catch (error) {
      await import("node:fs/promises").then(fs => fs.unlink(temporary).catch(() => {}));
      throw error;
    }
  }

  function queuePersist() {
    writeQueue = writeQueue.then(persist);
    return writeQueue;
  }

  return {
    async load() {
      try {
        const raw = await readFile(target, "utf8");
        try {
          state = normalizeState(JSON.parse(raw));
        } catch (error) {
          const backup = target + ".corrupt-" + Date.now() + ".bak";
          await copyFile(target, backup).catch(() => {});
          state = EMPTY_STATE();
          await queuePersist();
          throw new Error("Data file was invalid JSON; a backup was attempted at " + backup, { cause: error });
        }
      } catch (error) {
        if (error.code === "ENOENT") {
          state = EMPTY_STATE();
          await queuePersist();
        } else {
          throw error;
        }
      }
    },

    getGuild(guildId) {
      return structuredClone(state.guilds[guildId] ?? {});
    },

    async updateGuild(guildId, updater) {
      if (!/^\d{17,20}$/.test(guildId)) throw new TypeError("Invalid Discord guild ID.");
      if (typeof updater !== "function") throw new TypeError("Updater must be a function.");
      const current = structuredClone(state.guilds[guildId] ?? {});
      const next = updater(current);
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        throw new TypeError("Guild data updater must return an object.");
      }
      state.guilds[guildId] = next;
      await queuePersist();
      return structuredClone(next);
    },

    async flush() {
      await writeQueue;
    }
  };
}
