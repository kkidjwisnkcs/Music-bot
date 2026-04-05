'use strict';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('previous').setDescription('Play the previous song'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    try {
      await queue.previous();
      interaction.reply('⏮️ Playing previous song!');
    } catch {
      interaction.reply({ content: '❌ No previous song available.', ephemeral: true });
    }
  },
};
