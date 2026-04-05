const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing song'),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guild.id);
    if (!player || !player.currentSong) {
      return interaction.reply({ content: '❌ Nothing is playing right now!', ephemeral: true });
    }

    const song = player.currentSong;
    const status = player.isPaused ? '⏸️ Paused' : '▶️ Playing';

    const embed = new EmbedBuilder()
      .setColor(player.isPaused ? 0xFFA500 : 0x1DB954)
      .setAuthor({ name: `${status}` })
      .setTitle(song.title)
      .setURL(song.url)
      .addFields(
        { name: '⏱️ Duration', value: song.duration, inline: true },
        { name: '🔊 Volume', value: `${Math.round(player.volume * 100)}%`, inline: true },
        { name: '🔁 Loop', value: player.loop, inline: true },
        { name: '📋 Queue', value: `${player.queue.length} song(s)`, inline: true },
        { name: '👤 Requested By', value: song.requestedBy, inline: true },
      )
      .setFooter({ text: 'Use /skip to skip | /pause to pause | /queue to see queue' });
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);

    return interaction.reply({ embeds: [embed] });
  },
};
