// ============================================================
// Music Bot — DisTube v5
// Plugins: YouTube + SoundCloud + Spotify + yt-dlp fallback
// Encryption: sodium-native (fast native, works on Railway)
// Based on proven pattern from iTzArshia/Discord-Music-Bot
// ============================================================
'use strict';

const {
  Client, GatewayIntentBits, Collection,
  REST, Routes, EmbedBuilder,
} = require('discord.js');
const { DisTube } = require('distube');
const { YouTubePlugin }    = require('@distube/youtube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { SpotifyPlugin }    = require('@distube/spotify');
const { YtDlpPlugin }      = require('@distube/yt-dlp');
const { DirectLinkPlugin } = require('@distube/direct-link');
const fs   = require('fs');
const path = require('path');

// ── Validate env ──────────────────────────────────────────
for (const key of ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID']) {
  if (!process.env[key]) {
    console.error(`❌ Missing env: ${key}`);
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

// ── DisTube with all plugins ──────────────────────────────
client.distube = new DisTube(client, {
  plugins: [
    new YouTubePlugin(),           // YouTube search + playback
    new SoundCloudPlugin(),        // SoundCloud
    new SpotifyPlugin({            // Spotify → search on YouTube/SC
      parallel: true,
      emitEventsAfterFetching: false,
    }),
    new YtDlpPlugin({ update: false }),  // fallback for 700+ sites
    new DirectLinkPlugin(),        // direct mp3/wav/ogg URLs
  ],
});

// ── Load commands ─────────────────────────────────────────
client.commands = new Collection();
const commandsData = [];
const cmdPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(cmdPath).filter(f => f.endsWith('.js'))) {
  try {
    const cmd = require(path.join(cmdPath, file));
    if (cmd.data && cmd.execute) {
      client.commands.set(cmd.data.name, cmd);
      commandsData.push(cmd.data.toJSON());
      console.log(`📦 Loaded: /${cmd.data.name}`);
    }
  } catch (err) {
    console.error(`❌ Failed loading ${file}:`, err.message);
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
          `**Duration:** ${song.formattedDuration}  |  **By:** ${song.member}\n` +
          `**Source:** ${song.uploader?.name || song.source || 'Unknown'}`
        )
        .setThumbnail(song.thumbnail || null)
        .setFooter({
          text: `Queue: ${Math.max(0, queue.songs.length - 1)} more  |  Vol: ${queue.volume}%`,
        })],
    }).catch(() => {});
  })
  .on('addSong', (queue, song) => {
    if (queue.songs.length <= 1) return;
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✅ Added to Queue')
        .setDescription(`**[${song.name}](${song.url})**`)
        .addFields(
          { name: 'Duration', value: song.formattedDuration, inline: true },
          { name: 'Position', value: `#${queue.songs.length - 1}`, inline: true },
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
        .setDescription('✅ Queue finished. Use `/play` to add more.')],
    }).catch(() => {});
  })
  .on('disconnect', queue => {
    queue.textChannel?.send('👋 Disconnected.').catch(() => {});
  })
  .on('empty', queue => {
    queue.textChannel?.send('🔇 Voice channel empty — leaving.').catch(() => {});
  })
  .on('error', (channel, err) => {
    console.error('[DisTube]', err.message);
    let msg = err.message || 'Unknown error';
    if (/sign in|bot|age|login/i.test(msg))
      msg = 'YouTube blocked this. Try searching by name or use a SoundCloud/Spotify link.';
    else if (/private|unavailable/i.test(msg))
      msg = 'This track is private or unavailable.';
    else if (/no result|not found/i.test(msg))
      msg = 'No results found. Try a different search.';
    else if (/429|rate/i.test(msg))
      msg = 'Rate limited — try again in a moment.';
    else
      msg = msg.slice(0, 200);
    channel?.send({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${msg}`)],
    }).catch(() => {});
  })
  .on('initQueue', queue => {
    queue.volume = 80;
  });

// ── Interactions ──────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction, client);
  } catch (err) {
    console.error(`[Cmd/${interaction.commandName}]`, err.message);
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

// ── Register slash commands on startup ────────────────────
async function register() {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
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
  await register();
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});
