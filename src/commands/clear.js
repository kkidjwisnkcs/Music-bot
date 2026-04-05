const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear the queue (keeps current song playing)'),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player || !player.queue.length) {
      return interaction.reply({ content: '❌ The queue is already empty!', ephemeral: true });
    }
    const count = player.queue.length;
    player.queue = [];
    return interaction.reply({ content: `🗑️ Cleared **${count}** song(s) from the queue. Current song will finish.` });
  },
};
