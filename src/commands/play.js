const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
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

    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.editReply({ content: '❌ You need to be in a voice channel first!' });
    }

    // Check bot permissions in that specific channel
    const botMember = interaction.guild.members.me;
    const perms = voiceChannel.permissionsFor(botMember);

    if (!perms) {
      return interaction.editReply({ content: '❌ I cannot read permissions for that voice channel.' });
    }

    const missing = [];
    if (!perms.has(PermissionsBitField.Flags.Connect)) missing.push('Connect');
    if (!perms.has(PermissionsBitField.Flags.Speak)) missing.push('Speak');

    if (missing.length > 0) {
      return interaction.editReply({
        content: `❌ I'm missing these permissions in **${voiceChannel.name}**: **${missing.join(', ')}**\n` +
          `Please give me those permissions in that voice channel's settings.`
      });
    }

    // User limit check
    if (voiceChannel.userLimit > 0 && voiceChannel.members.size >= voiceChannel.userLimit) {
      return interaction.editReply({ content: `❌ **${voiceChannel.name}** is full! (${voiceChannel.members.size}/${voiceChannel.userLimit})` });
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
        .setDescription(`Added **${result.count}** songs to the queue.\nFirst up: **${result.first.title}**`);
      await player.start();
      return interaction.editReply({ embeds: [embed] });
    }

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
