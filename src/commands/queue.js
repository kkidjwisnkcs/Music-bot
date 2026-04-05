const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue').setDescription('Show the queue')
    .addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    const page = (interaction.options.getInteger('page') || 1) - 1;
    const perPage = 10;
    const songs = queue.songs;
    const totalPages = Math.max(1, Math.ceil((songs.length - 1) / perPage));
    const start = 1 + page * perPage;
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🎵 Queue — ${interaction.guild.name}`)
      .setDescription(
        `**Now Playing:**\n🎶 [${songs[0].name}](${songs[0].url}) [${songs[0].formattedDuration}]\n\n` +
        (songs.length <= 1 ? '*Queue is empty*' :
          songs.slice(start, start + perPage).map((s, i) =>
            `\`${start + i}.\` [${s.name}](${s.url}) [${s.formattedDuration}]`
          ).join('\n'))
      )
      .setFooter({ text: `Page ${page+1}/${totalPages} • ${songs.length-1} in queue • Volume: ${queue.volume}% • Loop: ${['Off','Song','Queue'][queue.repeatMode]}` });
    interaction.reply({ embeds: [embed] });
  },
};
