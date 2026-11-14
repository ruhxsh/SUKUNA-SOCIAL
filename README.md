# SUKUNA SOCIAL

Independent Discord bot for the social features of the SUKUNA server.

## Current foundation

The initial runtime, prefix command router, structured logging, and JSON persistence layer are in place. Feature specifications are still being finalized. Profile, relationship, reaction-role, and automatic-join-role behavior have **not** been implemented.

## Requirements

- Node.js 22 or newer
- Discord application bot token
- Discord.js 14

## Setup

1. Install dependencies with `npm install`.
2. Set `DISCORD_TOKEN` in the hosting environment.
3. Enable the **Message Content Intent** in the Discord Developer Portal for prefix commands.
4. Start the bot with `npm start`.

The command prefix is lowercase `s`. The initial command is `s help`.

## Checks

- `npm run check` — syntax checks for the application files.
- `npm test` — persistence tests.

## Data and secrets

Runtime data is stored in `data/social-data.json` by default. The data directory and environment files are excluded from Git. Never commit a bot token.
