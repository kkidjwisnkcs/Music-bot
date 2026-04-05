'use strict';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue || queue.songs.length <= 1) return interaction.reply({ content: '❌ Not enough songs to shuffle!', ephemeral: true });
    queue.shuffle();
    interaction.reply(`🔀 Queue shuffled! **${queue.songs.length - 1}** songs randomised.`);
  },
};
