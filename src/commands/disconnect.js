const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('disconnect').setDescription('Disconnect from voice channel'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (queue) { await queue.stop(); }
    const vc = interaction.guild.members.me?.voice?.channel;
    if (vc) { await interaction.guild.members.me.voice.disconnect(); }
    interaction.reply('👋 Disconnected!');
  },
};
