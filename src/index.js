const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Validate required env vars early
const requiredEnvVars = ['DISCORD_BOT_TOKEN'];
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

// Shared state: guild -> MusicPlayer
client.queues = new Map();
client.commands = new Collection();

// Load all commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`📦 Loaded command: ${command.data.name}`);
    }
  } catch (err) {
    console.error(`❌ Failed to load command ${file}:`, err.message);
  }
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🤖 Serving ${client.guilds.cache.size} server(s)`);
  client.user.setActivity('/play | Music Bot', { type: 2 }); // 2 = LISTENING
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

// Cleanup when guild voice state changes (bot left channel alone)
client.on('voiceStateUpdate', (oldState, newState) => {
  const player = client.queues.get(oldState.guild.id);
  if (!player) return;

  // If bot was moved or disconnected externally
  const botChannel = oldState.guild.members.me?.voice?.channel;
  if (!botChannel && player.connection) {
    player.destroy();
    client.queues.delete(oldState.guild.id);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('❌ Failed to login:', err.message);
  process.exit(1);
});
