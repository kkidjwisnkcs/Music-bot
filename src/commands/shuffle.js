const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the current queue'),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player || player.queue.length < 2) {
      return interaction.reply({ content: '❌ Need at least 2 songs in queue to shuffle!', ephemeral: true });
    }
    player.shuffle();
    return interaction.reply({ content: `🔀 Shuffled **${player.queue.length}** songs in the queue!` });
  },
};
