const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music and clear the queue'),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player) {
      return interaction.reply({ content: '❌ Nothing is playing right now!', ephemeral: true });
    }
    player.destroy();
    client.queues.delete(interaction.guild.id);
    return interaction.reply({ content: '⏹️ Stopped music and cleared the queue. Goodbye! 👋' });
  },
};
