'use strict';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from the queue by position')
    .addIntegerOption(o => o.setName('position').setDescription('Position in queue (1 = next)').setRequired(true).setMinValue(1)),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue || queue.songs.length <= 1) return interaction.reply({ content: '❌ Queue is empty!', ephemeral: true });
    const pos = interaction.options.getInteger('position');
    if (pos >= queue.songs.length) return interaction.reply({ content: `❌ Queue only has **${queue.songs.length - 1}** song(s).`, ephemeral: true });
    const removed = queue.songs.splice(pos, 1)[0];
    interaction.reply(`🗑️ Removed **${removed.name}** from position #${pos}.`);
  },
};
