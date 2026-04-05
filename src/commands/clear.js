const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('clear').setDescription('Clear the queue (keeps current song)'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue || queue.songs.length < 2) return interaction.reply({ content: '❌ Queue is already empty!', ephemeral: true });
    const count = queue.songs.length - 1;
    queue.songs.splice(1);
    interaction.reply(`🗑️ Cleared **${count}** song(s) from the queue.`);
  },
};
