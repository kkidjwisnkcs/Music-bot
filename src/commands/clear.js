'use strict';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('clear').setDescription('Clear the queue (keeps current song)'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    const count = queue.songs.length - 1;
    if (count === 0) return interaction.reply({ content: 'ℹ️ Queue is already empty.', ephemeral: true });
    queue.songs.splice(1);
    interaction.reply(`🗑️ Cleared **${count}** song(s) from the queue.`);
  },
};
