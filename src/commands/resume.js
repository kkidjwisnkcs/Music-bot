const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume paused music'),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player || !player.isPaused) {
      return interaction.reply({ content: '❌ Nothing is paused right now!', ephemeral: true });
    }
    const success = player.resume();
    return interaction.reply({ content: success ? '▶️ Resumed!' : '❌ Could not resume.' });
  },
};
