const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player || (!player.isPlaying && !player.isPaused)) {
      return interaction.reply({ content: '❌ Nothing is playing right now!', ephemeral: true });
    }
    const skipped = player.currentSong?.title || 'Unknown';
    player.skip();
    return interaction.reply({ content: `⏭️ Skipped **${skipped}**` });
  },
};
