// ============================================================
// Music Bot — DisTube v5
// Primary:  SoundCloud (no bot detection, free, unlimited)
// Fallback: YouTube via yt-dlp with bypass args
// Extras:   Spotify link support (converts to SC/YT stream)
// Encryption: tweetnacl (pure JS, Railway compatible)
// ============================================================
'use strict';

// Load encryption before anything else
try {
  const nacl = require('tweetnacl');
  if (!nacl?.secretbox) throw new Error('secretbox missing');
  console.log('[OK] tweetnacl loaded');
} catch (err) {
  console.error('[FATAL] tweetnacl failed:', err.message);
  process.exit(1);
}

try { require('opusscript'); console.log('[OK] opusscript loaded'); }
catch { console.warn('[WARN] opusscript not found — will use system opus'); }

const {
  Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder,
} = require('discord.js');
const { DisTube, RepeatMode } = require('distube');
const { YtDlpPlugin }         = require('@distube/yt-dlp');

// SoundCloud — primary search, never blocks bots
let SoundCloudPlugin;
try { SoundCloudPlugin = require('@distube/soundcloud').SoundCloudPlugin; }
catch { console.warn('[WARN] @distube/soundcloud not installed yet'); }

// Spotify — converts Spotify links to playable streams
let SpotifyPlugin;
try { SpotifyPlugin = require('@distube/spotify').SpotifyPlugin; }
catch { console.warn('[WARN] @distube/spotify not installed yet'); }

const fs   = require('fs');
const path = require('path');

// ── Validate env ──────────────────────────────────────────
for (const key of ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID']) {
  if (!process.env[key]) {
    console.error('❌ Missing env: ' + key);
    process.exit(1);
  }
}

// ── Discord client ────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ── Build plugin list ─────────────────────────────────────
// Order matters: SoundCloud first so name searches hit SC not YT
const plugins = [];

if (SoundCloudPlugin) {
  plugins.push(new SoundCloudPlugin());
  console.log('[OK] SoundCloud plugin loaded — will be primary search source');
}

if (SpotifyPlugin) {
  plugins.push(new SpotifyPlugin({
    parallel: true,     // search tracks in parallel for faster playlists
    emitEventsAfterFetching: false,
  }));
  console.log('[OK] Spotify plugin loaded');
}

// yt-dlp last — handles YouTube URLs + fallback
// YouTube bypass args: use mweb player client (less likely to get blocked than desktop)
plugins.push(new YtDlpPlugin({
  update: false,
  ytdlOptions: {
    // These yt-dlp args bypass most YouTube bot detection:
    // player_client=mweb uses the mobile web player which is less restricted
    // skip_webpage reduces fingerprint
    addHeader: [
      'referer:youtube.com',
      'user-agent:Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
    ],
    extractorArgs: { youtube: ['player_client=mweb,web'] },
    format: 'bestaudio[ext=webm]/bestaudio/best',
  },
}));
console.log('[OK] yt-dlp plugin loaded (YouTube fallback with bypass args)');

// ── DisTube v5 ────────────────────────────────────────────
client.distube = new DisTube(client, { plugins });

// ── Load commands ─────────────────────────────────────────
client.commands = new Collection();
const commandsData = [];
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  try {
    const cmd = require(path.join(commandsPath, file));
    if (cmd.data && cmd.execute) {
      client.commands.set(cmd.data.name, cmd);
      commandsData.push(cmd.data.toJSON());
      console.log(`📦 Loaded: ${cmd.data.name}`);
    }
  } catch (err) {
    console.error(`❌ Failed to load ${file}:`, err.message);
  }
}

// ── DisTube events ────────────────────────────────────────
client.distube
  .on('playSong', (queue, song) => {
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(0x1DB954)
        .setAuthor({ name: '🎵 Now Playing' })
        .setTitle(song.name)
        .setURL(song.url)
        .setDescription(
          `**Duration:** ${song.formattedDuration}  |  **Requested by:** ${song.member}\n` +
          `**Source:** ${song.uploader?.name || song.source || 'Unknown'}`
        )
        .setThumbnail(song.thumbnail || null)
        .setFooter({
          text: `Queue: ${Math.max(0, queue.songs.length - 1)} more  |  Vol: ${queue.volume}%  |  Loop: ${['Off','Song','Queue'][queue.repeatMode]}`,
        })],
    }).catch(() => {});
  })

  .on('addSong', (queue, song) => {
    if (queue.songs.length <= 1) return; // first song — playSong handles it
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✅ Added to Queue')
        .setDescription(`**[${song.name}](${song.url})**`)
        .addFields(
          { name: 'Duration', value: song.formattedDuration, inline: true },
          { name: 'Position', value: `#${queue.songs.length - 1}`, inline: true },
          { name: 'Source',   value: song.source || 'Unknown', inline: true },
        )
        .setThumbnail(song.thumbnail || null)],
    }).catch(() => {});
  })

  .on('addList', (queue, playlist) => {
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Playlist Added')
        .setDescription(`**${playlist.name}** — ${playlist.songs.length} songs`)],
    }).catch(() => {});
  })

  .on('finish', queue => {
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(0x2D7D46)
        .setDescription('✅ Queue finished. Use `/play` to add more songs.')],
    }).catch(() => {});
  })

  .on('disconnect', queue => {
    queue.textChannel?.send('👋 Disconnected from voice.').catch(() => {});
  })

  .on('empty', queue => {
    queue.textChannel?.send('🔇 Voice channel empty — leaving.').catch(() => {});
  })

  .on('error', (channel, err) => {
    console.error('[DisTube Error]', err.message);
    let msg = err.message || 'Unknown error';

    if (/sign in|confirm your age|bot detected/i.test(msg)) {
      msg = '⚠️ YouTube blocked this request. Try searching by **song name** (uses SoundCloud) or paste a **SoundCloud link** directly.';
    } else if (/private|unavailable|removed/i.test(msg)) {
      msg = '❌ This track is private or unavailable. Try a different source.';
    } else if (/no result|not found|cannot find/i.test(msg)) {
      msg = '❌ No results found. Try a different search term.';
    } else if (/429|rate.?limit/i.test(msg)) {
      msg = '⏳ Rate limited. Try again in a moment.';
    } else {
      msg = `❌ ${msg.slice(0, 200)}`;
    }

    channel?.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(msg)] }).catch(() => {});
  })

  .on('initQueue', queue => {
    queue.volume     = 80;
    queue.repeatMode = RepeatMode.DISABLED;
  });

// ── Interaction handler ───────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`[Command Error] /${interaction.commandName}:`, err.message);
    const payload = {
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${err.message.slice(0, 200)}`)],
      ephemeral: true,
    };
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch { /* already replied */ }
  }
});

// ── Register slash commands ───────────────────────────────
async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    console.log('🔄 Registering slash commands...');
    if (process.env.DISCORD_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
        { body: commandsData }
      );
      console.log('✅ Commands registered (guild — instant)');
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commandsData }
      );
      console.log('✅ Commands registered (global)');
    }
  } catch (err) {
    console.error('❌ Command registration failed:', err.message);
  }
}

client.once('clientReady', async c => {
  console.log(`✅ ${c.user.tag} online — ${c.guilds.cache.size} server(s)`);
  c.user.setActivity('/play | Music Bot', { type: 2 });
  await registerCommands();
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});
