const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreatePlayer } = require('../utils/getPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist from YouTube')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Song name, YouTube URL, or playlist URL')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({ content: '❌ You need to be in a voice channel!' });
    }

    const perms = voiceChannel.permissionsFor(interaction.client.user);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      return interaction.editReply({ content: '❌ I need **Connect** and **Speak** permissions in your voice channel!' });
    }

    const query = interaction.options.getString('query');
    const player = getOrCreatePlayer(client, interaction.guild.id);
    player.textChannel = interaction.channel;

    // Join voice channel
    try {
      await player.join(voiceChannel);
    } catch (err) {
      client.queues.delete(interaction.guild.id);
      return interaction.editReply({ content: `❌ ${err.message}` });
    }

    // Add song(s) to queue
    let result;
    try {
      result = await player.addSong(query, interaction.user.toString());
    } catch (err) {
      return interaction.editReply({ content: `❌ ${err.message}` });
    }

    // Playlist result
    if (result?.playlist) {
      const embed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle('📋 Playlist Added!')
        .setDescription(`Added **${result.count}** songs to the queue.\nFirst up: **${result.first.title}**`)
        .setFooter({ text: `Queue position: ${player.queue.length - result.count + 1}–${player.queue.length + (player.currentSong ? 0 : -1)}` });

      await player.start();
      return interaction.editReply({ embeds: [embed] });
    }

    // If nothing is playing, start playback
    const wasIdle = !player.isPlaying && !player.isPaused;
    await player.start();

    if (wasIdle) {
      return interaction.editReply({ content: '▶️ Starting playback...' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('✅ Added to Queue')
      .setDescription(`**[${result.title}](${result.url})**`)
      .addFields(
        { name: 'Duration', value: result.duration, inline: true },
        { name: 'Position', value: `#${player.queue.length}`, inline: true },
        { name: 'Requested by', value: result.requestedBy, inline: true }
      );
    if (result.thumbnail) embed.setThumbnail(result.thumbnail);
    return interaction.editReply({ embeds: [embed] });
  },
};
