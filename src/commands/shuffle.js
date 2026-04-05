const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue || queue.songs.length < 3) return interaction.reply({ content: '❌ Need at least 2 songs in queue!', ephemeral: true });
    await queue.shuffle();
    interaction.reply(`🔀 Shuffled **${queue.songs.length - 1}** songs!`);
  },
};
