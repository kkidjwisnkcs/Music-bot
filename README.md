# 🎵 Discord Music Bot

A feature-rich Discord music bot powered by `play-dl` and `@discordjs/voice`. Plays YouTube audio with a full queue system, slash commands, and rich embeds.

## Commands

| Command | Description |
|---------|-------------|
| `/play <query>` | Play a song or YouTube playlist |
| `/skip` | Skip the current song |
| `/stop` | Stop music and clear the queue |
| `/pause` | Pause playback |
| `/resume` | Resume paused music |
| `/queue [page]` | View the queue |
| `/nowplaying` | Show the current song |
| `/volume <0-100>` | Set the volume |
| `/loop <off/song/queue>` | Set loop mode |
| `/shuffle` | Shuffle the queue |
| `/remove <position>` | Remove a song from the queue |
| `/clear` | Clear the queue (keeps current song) |
| `/disconnect` | Disconnect from voice channel |

## Railway Deployment

### 1. Set Environment Variables in Railway
Go to your Railway project → Variables:
```
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_server_id  # optional, for instant command updates
```

### 2. Deploy Slash Commands
After the first deploy, run this in Railway's shell tab (one-time setup):
```bash
node src/deploy-commands.js
```
Or set it as a one-time command.

### 3. Bot Permissions
When inviting the bot, ensure these permissions:
- ✅ Connect (voice)
- ✅ Speak (voice)
- ✅ Send Messages
- ✅ Embed Links
- ✅ Read Message History
- ✅ Use Slash Commands

Also enable in Discord Developer Portal → Bot → Privileged Gateway Intents:
- ✅ Server Members Intent
- ✅ Message Content Intent (optional but recommended)

## Technical Stack
- `discord.js` v14 — Discord API wrapper
- `@discordjs/voice` — Voice connection management
- `play-dl` — YouTube audio streaming (maintained, works without ytdl-core)
- `ffmpeg-static` — Audio transcoding (bundled)
- `@discordjs/opus` — Audio encoding
