const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player || !player.isPlaying) {
      return interaction.reply({ content: '❌ Nothing is playing right now!', ephemeral: true });
    }
    const success = player.pause();
    return interaction.reply({ content: success ? '⏸️ Paused!' : '❌ Could not pause.' });
  },
};
