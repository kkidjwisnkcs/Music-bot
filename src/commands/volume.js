const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the playback volume')
    .addIntegerOption(opt =>
      opt.setName('level')
        .setDescription('Volume level (0-100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player) {
      return interaction.reply({ content: '❌ Nothing is playing right now!', ephemeral: true });
    }
    const level = interaction.options.getInteger('level');
    player.setVolume(level);
    const emoji = level === 0 ? '🔇' : level < 40 ? '🔈' : level < 70 ? '🔉' : '🔊';
    return interaction.reply({ content: `${emoji} Volume set to **${level}%**` });
  },
};
