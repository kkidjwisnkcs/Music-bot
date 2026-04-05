const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnect the bot from voice channel'),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player) {
      return interaction.reply({ content: '❌ I am not in a voice channel!', ephemeral: true });
    }
    player.destroy();
    client.queues.delete(interaction.guild.id);
    return interaction.reply({ content: '👋 Disconnected from voice channel and cleared queue.' });
  },
};
