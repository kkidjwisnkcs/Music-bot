const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the music'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue || queue.paused) return interaction.reply({ content: '❌ Nothing to pause!', ephemeral: true });
    queue.pause();
    interaction.reply('⏸️ Paused!');
  },
};
