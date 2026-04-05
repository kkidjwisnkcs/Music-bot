'use strict';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume paused music'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    if (!queue.paused) return interaction.reply({ content: 'ℹ️ Music is already playing.', ephemeral: true });
    queue.resume();
    interaction.reply('▶️ Resumed!');
  },
};
