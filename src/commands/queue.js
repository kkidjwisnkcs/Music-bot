const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue')
    .addIntegerOption(opt =>
      opt.setName('page')
        .setDescription('Page number')
        .setMinValue(1)
    ),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player || !player.currentSong) {
      return interaction.reply({ content: '❌ Nothing is playing right now!', ephemeral: true });
    }

    const page = (interaction.options.getInteger('page') || 1) - 1;
    const perPage = 10;
    const start = page * perPage;
    const queue = player.queue;
    const totalPages = Math.max(1, Math.ceil(queue.length / perPage));

    if (page >= totalPages && queue.length > 0) {
      return interaction.reply({ content: `❌ Page ${page + 1} doesn't exist. Max page: ${totalPages}`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🎵 Queue — ${interaction.guild.name}`)
      .setDescription(
        `**Now Playing:**\n🎶 [${player.currentSong.title}](${player.currentSong.url}) [${player.currentSong.duration}] — ${player.currentSong.requestedBy}\n\n` +
        (queue.length === 0
          ? '*No songs in queue*'
          : queue.slice(start, start + perPage).map((s, i) =>
              `\`${start + i + 1}.\` [${s.title}](${s.url}) [${s.duration}] — ${s.requestedBy}`
            ).join('\n')
        )
      )
      .setFooter({
        text: `Page ${page + 1}/${totalPages} • ${queue.length} song(s) in queue • Loop: ${player.loop} • Volume: ${Math.round(player.volume * 100)}%`
      });

    return interaction.reply({ embeds: [embed] });
  },
};
