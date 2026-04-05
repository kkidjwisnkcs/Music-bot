const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume paused music'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue || !queue.paused) return interaction.reply({ content: '❌ Nothing is paused!', ephemeral: true });
    queue.resume();
    interaction.reply('▶️ Resumed!');
  },
};
