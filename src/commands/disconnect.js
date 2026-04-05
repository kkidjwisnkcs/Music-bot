'use strict';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('disconnect').setDescription('Disconnect the bot from voice'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (queue) {
      await queue.stop();
    } else {
      const vc = interaction.guild.members.me?.voice?.channel;
      if (!vc) return interaction.reply({ content: '❌ I\'m not in a voice channel.', ephemeral: true });
    }
    interaction.reply('👋 Disconnected from voice!');
  },
};
