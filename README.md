# SUKUNA SOCIAL

Independent Discord bot for social interaction and member profiles.

## Implemented core features

- Member profiles with creation dates, bios, and custom information.
- Profile editing and reset while preserving social history.
- Public/private profile and statistics visibility.
- Friendly interactions: hug, high-five, pat, wave, compliment, and thank.
- Interaction counters for given, received, and total activity.
- Automatic achievement milestones.
- Relationship requests, acceptance, decline, status, and removal.
- Public social activity leaderboard.
- Persistent JSON storage with serialized updates.

## Commands

- s help
- s profile create
- s profile [view] [@member]
- s profile bio <text>
- s profile about <text>
- s profile reset
- s profile privacy public|private
- s profile stats public|private
- s hug|highfive|pat|wave|compliment|thank @member
- s relationship request @member
- s relationship accept|decline @member
- s relationship status [@member]
- s relationship remove @member
- s socialstats [@member]
- s socialleaderboard

## Setup

- Node.js 22 or newer
- Discord.js 14
- Set DISCORD_TOKEN in the host environment.
- Enable Message Content Intent in the Discord Developer Portal.
- Run npm install, npm test, npm run check, then npm start.

The prefix is lowercase s. Data is stored in data/social-data.json by default. Keep the data directory and token out of Git.

## Deferred features

Reaction roles and automatic join-role assignment are intentionally deferred until the core SOCIAL features have been reviewed and tested.
