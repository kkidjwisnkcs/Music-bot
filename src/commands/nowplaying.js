const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show current song'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    const song = queue.songs[0];
    const embed = new EmbedBuilder()
      .setColor(queue.paused ? 0xFFA500 : 0x1DB954)
      .setAuthor({ name: queue.paused ? '⏸️ Paused' : '▶️ Playing' })
      .setTitle(song.name).setURL(song.url)
      .addFields(
        { name: '⏱️ Duration', value: song.formattedDuration, inline: true },
        { name: '🔊 Volume', value: `${queue.volume}%`, inline: true },
        { name: '🔁 Loop', value: ['Off','Song','Queue'][queue.repeatMode], inline: true },
        { name: '📋 In Queue', value: `${queue.songs.length - 1} song(s)`, inline: true },
      )
      .setThumbnail(song.thumbnail);
    interaction.reply({ embeds: [embed] });
  },
};
