import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const EMPTY_STATE = () => ({ version: 1, guilds: {} });

function normalizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_STATE();
  if (!value.guilds || typeof value.guilds !== "object" || Array.isArray(value.guilds)) {
    return EMPTY_STATE();
  }
  return { version: 1, guilds: value.guilds };
}

export function createStore(filePath) {
  const target = resolve(filePath);
  let state = EMPTY_STATE();
  let writeQueue = Promise.resolve();
  let operationQueue = Promise.resolve();

  async function persist() {
    const snapshot = JSON.stringify(state, null, 2);
    await mkdir(dirname(target), { recursive: true });
    const temporary = target + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporary, snapshot, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
  }

  function queuePersist() {
    writeQueue = writeQueue.catch(() => {}).then(persist);
    return writeQueue;
  }

  return {
    async load() {
      let raw;
      try {
        raw = await readFile(target, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        state = EMPTY_STATE();
        await queuePersist();
        return;
      }

      try {
        state = normalizeState(JSON.parse(raw));
      } catch (error) {
        const backup = target + ".corrupt-" + Date.now() + ".bak";
        await copyFile(target, backup);
        state = EMPTY_STATE();
        await queuePersist();
        throw new Error("Data file was invalid JSON; original data was backed up to " + backup, { cause: error });
      }
    },

    getGuild(guildId) {
      return structuredClone(state.guilds[guildId] ?? {});
    },

    updateGuild(guildId, updater) {
      if (typeof guildId !== "string" || !/^\d{17,20}$/.test(guildId)) {
        return Promise.reject(new TypeError("Invalid Discord guild ID."));
      }
      if (typeof updater !== "function") {
        return Promise.reject(new TypeError("Updater must be a function."));
      }

      let result;
      const operation = operationQueue.then(async () => {
        const current = structuredClone(state.guilds[guildId] ?? {});
        const next = updater(current);
        if (!next || typeof next !== "object" || Array.isArray(next)) {
          throw new TypeError("Guild data updater must return an object.");
        }
        state.guilds[guildId] = next;
        await queuePersist();
        result = structuredClone(next);
      });
      operationQueue = operation.catch(() => {});
      return operation.then(() => result);
    },

    async flush() {
      await operationQueue;
      await writeQueue;
    }
  };
}
