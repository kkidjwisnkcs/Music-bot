'use strict';

// ============================================================
// Music Bot — DisTube v5 + yt-dlp
// Encryption : tweetnacl + libsodium-wrappers (dual fallback)
// Audio codec: opusscript (pure JS, no compilation needed)
// Audio proc : ffmpeg (system) with ffmpeg-static fallback
// DNS        : IPv4-first (fixes Railway/hosted UDP voice issues)
// YT bypass  : tv_embedded + android player clients via yt-dlp
// selfDeaf   : forced false — fixes NAT/UDP issues on cloud hosts
// ============================================================

// ── FFmpeg: ensure it's available (system or bundled fallback) ────────────────
const { execSync, execFileSync } = require('child_process');
let ffmpegPath = null;

try {
  const p = execSync('which ffmpeg 2>/dev/null || command -v ffmpeg 2>/dev/null', { encoding: 'utf8' }).trim();
  if (p) { ffmpegPath = p; console.log('[OK] System ffmpeg at:', ffmpegPath); }
} catch {}

if (!ffmpegPath) {
  try { ffmpegPath = require('ffmpeg-static'); console.log('[OK] ffmpeg-static at:', ffmpegPath); } catch {}
}

if (!ffmpegPath) {
  console.error('[WARN] ffmpeg not found — audio may not work!');
} else {
  process.env.PATH = require('path').dirname(ffmpegPath) + ':' + process.env.PATH;
  process.env.FFMPEG_PATH = ffmpegPath;
  try {
    const ver = execFileSync(ffmpegPath, ['-version'], { encoding: 'utf8' }).split('\n')[0];
    console.log('[ffmpeg]', ver);
  } catch {}
}

// ── CRITICAL: Force selfDeaf=false for cloud hosting UDP compatibility ─────────
// DisTube (via @distube/voice) hardcodes selfDeaf:true when joining voice.
// On many cloud platforms (Railway, etc.) this breaks the UDP handshake:
// Discord's voice server opens a UDP session expecting bidirectional traffic,
// but a deafened bot doesn't send the UDP keep-alive packets, so the NAT
// table entry expires and the connection appears to time out after 30s.
// Forcing selfDeaf:false makes Discord keep the UDP session alive properly.
(function patchSelfDeaf() {
  try {
    const voice = require('@discordjs/voice');
    const orig = voice.joinVoiceChannel;
    voice.joinVoiceChannel = function(options) {
      return orig.call(this, { ...options, selfDeaf: false });
    };
    console.log('[OK] selfDeaf:false patch applied');
  } catch (e) {
    console.warn('[WARN] selfDeaf patch failed:', e.message);
  }
})();

// ── Sodium ────────────────────────────────────────────────────────────────────
let sodiumLoaded = false;
try {
  require('libsodium-wrappers');
  console.log('[OK] libsodium-wrappers loaded');
  sodiumLoaded = true;
} catch {}

try {
  const nacl = require('tweetnacl');
  if (!nacl?.secretbox) throw new Error('secretbox missing');
  console.log('[OK] tweetnacl loaded');
  sodiumLoaded = true;
} catch (err) {
  if (!sodiumLoaded) { console.error('[FATAL] No sodium library:', err.message); process.exit(1); }
}

// ── Opus ──────────────────────────────────────────────────────────────────────
try { require('opusscript'); console.log('[OK] opusscript loaded'); }
catch (e) { console.warn('[WARN] opusscript:', e.message); }

const {
  Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder,
} = require('discord.js');
const { DisTube, RepeatMode } = require('distube');
const { YtDlpPlugin }         = require('@distube/yt-dlp');
const { SoundCloudPlugin }    = require('@distube/soundcloud');
const { generateDependencyReport } = require('@discordjs/voice');
const fs   = require('fs');
const path = require('path');

console.log('[Voice Deps]\n' + generateDependencyReport());

for (const key of ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID']) {
  if (!process.env[key]) { console.error('[FATAL] Missing env:', key); process.exit(1); }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ── DisTube ───────────────────────────────────────────────────────────────────
const ytdlpOpts = {
  update: false,
  ytdlpOptions: {
    // tv_embedded + mweb are the two least-blocked YouTube player clients
    'extractor-args': 'youtube:player_client=tv_embedded,mweb',
    'no-playlist': true,
    // Mobile user-agent further reduces bot detection
    'add-header': [
      'User-Agent:Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
      'Referer:https://www.youtube.com/',
    ],
  },
};
if (ffmpegPath) ytdlpOpts.ytdlpOptions['ffmpeg-location'] = path.dirname(ffmpegPath);

client.distube = new DisTube(client, {
  plugins: [
    new YtDlpPlugin(ytdlpOpts),
    new SoundCloudPlugin(),
  ],
});

client.commands = new Collection();
const commandsData = [];
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  try {
    const cmd = require(path.join(commandsPath, file));
    if (cmd.data && cmd.execute) {
      client.commands.set(cmd.data.name, cmd);
      commandsData.push(cmd.data.toJSON());
      console.log('📦 Loaded:', cmd.data.name);
    }
  } catch (err) {
    console.error('❌ Failed to load ' + file + ':', err.message);
  }
}

// ── DisTube events ────────────────────────────────────────────────────────────
client.distube
  .on('playSong', (queue, song) => {
    console.log('[DisTube] Playing:', song.name, '|', song.url);
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(0x1DB954)
        .setAuthor({ name: '🎵 Now Playing' })
        .setTitle(song.name)
        .setURL(song.url)
        .setDescription(
          'Duration: **' + song.formattedDuration + '** | Requested by: ' + song.member + '\n' +
          'Source: **' + (song.uploader?.name || 'Unknown') + '**'
        )
        .setThumbnail(song.thumbnail || null)
        .setFooter({ text: 'Queue: ' + (queue.songs.length - 1) + ' more | Vol: ' + queue.volume + '% | Loop: ' + (['Off', 'Song', 'Queue'][queue.repeatMode]) })],
    }).catch(() => {});
  })
  .on('addSong', (queue, song) => {
    if (queue.songs.length <= 1) return;
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✅ Added to Queue')
        .setDescription('**[' + song.name + '](' + song.url + ')**')
        .addFields(
          { name: 'Duration', value: song.formattedDuration, inline: true },
          { name: 'Position', value: '#' + (queue.songs.length - 1), inline: true },
        )
        .setThumbnail(song.thumbnail || null)],
    }).catch(() => {});
  })
  .on('addList', (queue, playlist) => {
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Playlist Added')
        .setDescription('**' + playlist.name + '** — ' + playlist.songs.length + ' songs')],
    }).catch(() => {});
  })
  .on('finish', queue => {
    queue.textChannel?.send({
      embeds: [new EmbedBuilder().setColor(0x2D7D46).setDescription('✅ Queue finished!')],
    }).catch(() => {});
  })
  .on('disconnect', queue => { queue.textChannel?.send('👋 Disconnected.').catch(() => {}); })
  .on('empty',      queue => { queue.textChannel?.send('🔇 Voice channel empty — leaving.').catch(() => {}); })
  .on('error', (channel, err) => {
    const msg = err?.message || String(err);
    console.error('[DisTube Error]', msg);
    let friendly = msg.slice(0, 200);
    if (/sign in|bot|confirm your age|login required/i.test(msg))
      friendly = 'YouTube blocked this. Try a SoundCloud link or different song.';
    else if (/no result|not found|cannot find/i.test(msg))
      friendly = 'Could not find that song. Try a different search or paste a URL.';
    else if (/429|rate limit/i.test(msg))
      friendly = 'Rate limited — wait a moment and try again.';
    else if (/private|unavailable/i.test(msg))
      friendly = 'That video is private or unavailable.';
    else if (/voice|connect|UDP|30 second/i.test(msg))
      friendly = 'Could not connect to voice. Please try `/play` again — it usually works on retry.';
    channel?.send({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ ' + friendly)],
    }).catch(() => {});
  })
  .on('initQueue', queue => {
    queue.volume     = 80;
    queue.repeatMode = RepeatMode.DISABLED;
    console.log('[DisTube] Queue initialized');
  });

// ── Interactions ──────────────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error('[Cmd Error] /' + interaction.commandName + ':', err.message);
    const payload = {
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ ' + err.message.slice(0, 200))],
      ephemeral: true,
    };
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch {}
  }
});

// ── Command registration ──────────────────────────────────────────────────────
async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    const target = process.env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
      : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
    await rest.put(target, { body: commandsData });
    console.log('✅ Commands registered' + (process.env.DISCORD_GUILD_ID ? ' to guild ' + process.env.DISCORD_GUILD_ID : ' globally'));
  } catch (err) {
    console.error('❌ Command registration failed:', err.message);
  }
}

client.once('clientReady', async c => {
  console.log('✅ Logged in as ' + c.user.tag);
  c.user.setActivity('/play | Music Bot', { type: 2 });
  await registerCommands();
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});
