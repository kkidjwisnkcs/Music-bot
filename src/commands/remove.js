const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from the queue by position')
    .addIntegerOption(opt =>
      opt.setName('position')
        .setDescription('Queue position to remove (1 = next song)')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player || !player.queue.length) {
      return interaction.reply({ content: '❌ The queue is empty!', ephemeral: true });
    }
    const pos = interaction.options.getInteger('position') - 1;
    const removed = player.remove(pos);
    if (!removed) {
      return interaction.reply({ content: `❌ No song at position **${pos + 1}**`, ephemeral: true });
    }
    return interaction.reply({ content: `🗑️ Removed **${removed.title}** from position **${pos + 1}**` });
  },
};
