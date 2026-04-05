'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist — YouTube, SoundCloud, Spotify links or search by name.')
    .addStringOption(o => o
      .setName('query')
      .setDescription('Song name, YouTube URL, SoundCloud URL, or Spotify link')
      .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ **Join a voice channel first!**')],
      });
    }

    // Check bot has permissions
    const perms = voiceChannel.permissionsFor(interaction.guild.members.me);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription('❌ I need **Connect** and **Speak** permissions in that voice channel.')],
      });
    }

    const query = interaction.options.getString('query');

    try {
      await client.distube.play(voiceChannel, query, {
        member:      interaction.member,
        textChannel: interaction.channel,
        interaction,
      });

      // DisTube fires playSong/addSong events which send embeds — just ack here
      if (!interaction.replied) {
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x1DB954).setDescription(`🔍 Loading: \`${query}\`...`)],
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[Play Error]', err.message);
      let msg = err.message;
      if (msg.includes('Sign in') || msg.includes('bot') || msg.includes('age')) {
        msg = 'YouTube blocked this. Try a SoundCloud link or search with a song name.';
      } else if (msg.includes('No result') || msg.includes('not found')) {
        msg = `No results for **"${query}"**. Try a different search.`;
      }
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${msg.slice(0, 300)}`)],
      });
    }
  },
};
