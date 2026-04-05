const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const requiredEnvVars = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

client.queues = new Map();
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const commandsData = [];

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      commandsData.push(command.data.toJSON());
      console.log(`📦 Loaded command: ${command.data.name}`);
    }
  } catch (err) {
    console.error(`❌ Failed to load command ${file}:`, err.message);
  }
}

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    console.log('🔄 Registering slash commands...');

    if (process.env.DISCORD_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
        { body: commandsData }
      );
      console.log(`✅ Slash commands registered to guild ${process.env.DISCORD_GUILD_ID} (instant)`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commandsData }
      );
      console.log('✅ Global slash commands registered (may take up to 1 hour to appear)');
    }
  } catch (err) {
    console.error('❌ Failed to register commands:', err.message);
  }
}

client.once('clientReady', async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log(`🤖 Serving ${c.guilds.cache.size} server(s)`);
  c.user.setActivity('/play | Music Bot', { type: 2 });
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`[Command Error] ${interaction.commandName}:`, error);
    const errorMsg = { content: `❌ An error occurred: ${error.message}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    } catch {}
  }
});

client.on('voiceStateUpdate', (oldState) => {
  const player = client.queues.get(oldState.guild.id);
  if (!player) return;
  const botInChannel = oldState.guild.members.me?.voice?.channel;
  if (!botInChannel && player.connection) {
    player.destroy();
    client.queues.delete(oldState.guild.id);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('❌ Failed to login:', err.message);
  process.exit(1);
});
