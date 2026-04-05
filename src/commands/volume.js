const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('volume').setDescription('Set volume (0-100)')
    .addIntegerOption(o => o.setName('level').setDescription('Volume level').setRequired(true).setMinValue(0).setMaxValue(100)),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    const level = interaction.options.getInteger('level');
    queue.setVolume(level);
    const emoji = level === 0 ? '🔇' : level < 40 ? '🔈' : level < 70 ? '🔉' : '🔊';
    interaction.reply(`${emoji} Volume set to **${level}%**`);
  },
};
