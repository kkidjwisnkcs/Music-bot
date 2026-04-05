const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    try {
      await queue.skip();
      interaction.reply('⏭️ Skipped!');
    } catch { interaction.reply({ content: '❌ Cannot skip — no next song.', ephemeral: true }); }
  },
};
