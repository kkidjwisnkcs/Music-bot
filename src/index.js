const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const { DisTube, RepeatMode } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const fs = require('fs');
const path = require('path');

for (const key of ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID']) {
  if (!process.env[key]) { console.error(`❌ Missing: ${key}`); process.exit(1); }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// DisTube setup — handles all voice connection internally
client.distube = new DisTube(client, {
  plugins: [new YtDlpPlugin({ update: false })],
  emitNewSongOnly: false,
  joinNewVoiceChannel: true,
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
      console.log(`📦 Loaded: ${cmd.data.name}`);
    }
  } catch (err) { console.error(`❌ Failed to load ${file}:`, err.message); }
}

// DisTube events
client.distube
  .on('playSong', (queue, song) => {
    const { EmbedBuilder } = require('discord.js');
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(0x1DB954)
        .setAuthor({ name: '🎵 Now Playing' })
        .setTitle(song.name)
        .setURL(song.url)
        .setDescription(`Duration: **${song.formattedDuration}** | Requested by: ${song.member}`)
        .setThumbnail(song.thumbnail)
        .setFooter({ text: `Queue: ${queue.songs.length - 1} more | Volume: ${queue.volume}% | Loop: ${['Off','Song','Queue'][queue.repeatMode]}` })
      ]
    }).catch(() => {});
  })
  .on('addSong', (queue, song) => {
    const { EmbedBuilder } = require('discord.js');
    if (queue.songs.length > 1) {
      queue.textChannel?.send({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('✅ Added to Queue')
          .setDescription(`**[${song.name}](${song.url})**`)
          .addFields(
            { name: 'Duration', value: song.formattedDuration, inline: true },
            { name: 'Position', value: `#${queue.songs.length - 1}`, inline: true }
          )
          .setThumbnail(song.thumbnail)
        ]
      }).catch(() => {});
    }
  })
  .on('addList', (queue, playlist) => {
    queue.textChannel?.send(`📋 Added playlist **${playlist.name}** (${playlist.songs.length} songs)`).catch(() => {});
  })
  .on('error', (channel, err) => {
    console.error('[DisTube Error]', err.message);
    channel?.send(`❌ Error: ${err.message.slice(0, 200)}`).catch(() => {});
  })
  .on('finish', queue => {
    queue.textChannel?.send('✅ Queue finished! Use `/play` to add more songs.').catch(() => {});
  })
  .on('disconnect', queue => {
    queue.textChannel?.send('👋 Disconnected from voice channel.').catch(() => {});
  });

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    console.log('🔄 Registering slash commands...');
    if (process.env.DISCORD_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), { body: commandsData });
      console.log(`✅ Commands registered to guild (instant)`);
    } else {
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commandsData });
      console.log('✅ Global commands registered');
    }
  } catch (err) { console.error('❌ Command registration failed:', err.message); }
}

client.once('clientReady', async c => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log(`🤖 Serving ${c.guilds.cache.size} server(s)`);
  c.user.setActivity('/play | Music Bot', { type: 2 });
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`[Command Error] ${interaction.commandName}:`, err.message);
    const msg = { content: `❌ ${err.message}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(msg);
      else await interaction.reply(msg);
    } catch {}
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('❌ Login failed:', err.message); process.exit(1);
});
