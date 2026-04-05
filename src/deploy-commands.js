const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // optional: set for guild-specific deployment

if (!token || !clientId) {
  console.error('❌ Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in environment variables!');
  console.error('Set these in Railway environment variables and try again.');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`📦 Loaded: ${command.data.name}`);
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`\n🔄 Deploying ${commands.length} slash command(s)...`);

    let data;
    if (guildId) {
      // Guild commands — update instantly (good for testing)
      data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`✅ Deployed ${data.length} command(s) to guild ${guildId}`);
    } else {
      // Global commands — takes up to 1 hour to propagate
      data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`✅ Deployed ${data.length} global command(s)`);
      console.log('⏰ Global commands may take up to 1 hour to appear. Use DISCORD_GUILD_ID for instant updates.');
    }
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error.message);
    process.exit(1);
  }
})();
