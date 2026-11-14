const token = process.env.DISCORD_TOKEN?.trim();

export const config = Object.freeze({
  token,
  prefix: "s",
  dataFile: process.env.SUKUNA_SOCIAL_DATA_FILE || "./data/social-data.json"
});

export function validateConfig() {
  if (!config.token) {
    throw new Error("Missing DISCORD_TOKEN environment variable.");
  }
}
