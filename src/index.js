// ============================================================
// Music Bot — powered by DisTube + yt-dlp
// Voice deps: @discordjs/voice + libsodium-wrappers + opusscript
// ============================================================
'use strict';

// Load sodium BEFORE anything else — DisTube needs it at startup
try {
  const sodium = require('libsodium-wrappers');
  if (sodium.ready) {
    sodium.ready.then(() => console.log('✅ libsodium-wrappers ready'));
  }
} catch {
  console.warn('⚠️ libsodium-wrappers not available — trying tweetnacl fallback');
}

const {
  Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder,
} = require('discord.js');
const { DisTube, RepeatMode } = require('distube');
const { YtDlpPlugin }        = require('@distube/yt-dlp');
const fs   = require('fs');
const path = require('path');

// ── Validate env ──────────────────────────────────────────
for (const key of ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID']) {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`);
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

// ── DisTube ───────────────────────────────────────────────
client.distube = new DisTube(client, {
  plugins: [
    new YtDlpPlugin({
      update: false,             // never auto-update yt-dlp — keeps Railway stable
    }),
  ],
  emitNewSongOnly:      false,
  joinNewVoiceChannel:  true,
  nsfw:                 true,    // don't block anything based on channel NSFW flag
  savePreviousSongs:    true,    // allow /previous command
});

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
          `Duration: **${song.formattedDuration}** | Requested by: ${song.member}\n` +
          `Source: **${song.uploader?.name || 'Unknown'}**`
        )
        .setThumbnail(song.thumbnail || null)
        .setFooter({
          text: `Queue: ${queue.songs.length - 1} more | Volume: ${queue.volume}% | Loop: ${['Off','Song','Queue'][queue.repeatMode]}`,
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
        .setDescription('✅ Queue finished! Use `/play` to add more songs.')],
    }).catch(() => {});
  })

  .on('disconnect', queue => {
    queue.textChannel?.send('👋 Disconnected.').catch(() => {});
  })

  .on('empty', queue => {
    queue.textChannel?.send('🔇 Voice channel is empty — leaving.').catch(() => {});
  })

  .on('error', (channel, err) => {
    console.error('[DisTube Error]', err.message);
    // Friendly error messages
    let msg = err.message;
    if (msg.includes('Sign in') || msg.includes('bot') || msg.includes('confirm your age')) {
      msg = 'YouTube is blocking this request. Try a SoundCloud/Spotify link or search by name.';
    } else if (msg.includes('No result') || msg.includes('not found')) {
      msg = 'No results found. Try a different search term.';
    } else if (msg.includes('429') || msg.includes('rate')) {
      msg = 'Rate limited by the source. Try again in a moment.';
    } else {
      msg = msg.slice(0, 200);
    }
    channel?.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${msg}`)] }).catch(() => {});
  })

  .on('initQueue', queue => {
    queue.volume    = 80;   // default volume 80%
    queue.repeatMode = RepeatMode.DISABLED;
  });

// ── Interactions ──────────────────────────────────────────
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
      console.log('✅ Commands registered to guild (instant)');
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commandsData }
      );
      console.log('✅ Global commands registered (up to 1hr propagation)');
    }
  } catch (err) {
    console.error('❌ Command registration failed:', err.message);
  }
}

client.once('clientReady', async c => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log(`🤖 Serving ${c.guilds.cache.size} server(s)`);
  c.user.setActivity('/play | Music Bot', { type: 2 });
  await registerCommands();
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});
