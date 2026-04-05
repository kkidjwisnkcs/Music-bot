const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set loop mode')
    .addStringOption(opt =>
      opt.setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: '🔴 Off', value: 'off' },
          { name: '🔂 Song (repeat current song)', value: 'song' },
          { name: '🔁 Queue (repeat whole queue)', value: 'queue' },
        )
    ),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player) {
      return interaction.reply({ content: '❌ Nothing is playing right now!', ephemeral: true });
    }
    const mode = interaction.options.getString('mode');
    player.loop = mode;
    const icons = { off: '🔴', song: '🔂', queue: '🔁' };
    const labels = { off: 'Off', song: 'Song', queue: 'Queue' };
    return interaction.reply({ content: `${icons[mode]} Loop mode set to **${labels[mode]}**` });
  },
};
