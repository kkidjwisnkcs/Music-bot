// /play — Primary: SoundCloud search. YouTube URLs still work via yt-dlp.
'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const YT_URL_RE = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i;
const SC_URL_RE = /^https?:\/\/(www\.)?soundcloud\.com\//i;
const SP_URL_RE = /^https?:\/\/(open\.)?spotify\.com\//i;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song — search by name (SoundCloud), or paste a YouTube/SoundCloud/Spotify link.')
    .addStringOption(o => o
      .setName('query')
      .setDescription('Song name or URL (YouTube, SoundCloud, Spotify)')
      .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ **Join a voice channel first.**')],
      });
    }

    const perms = voiceChannel.permissionsFor(interaction.guild.members.me);
    if (!perms?.has('Connect') || !perms?.has('Speak')) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription('❌ I need **Connect** and **Speak** permissions in that voice channel.')],
      });
    }

    const rawQuery = interaction.options.getString('query');

    // Determine source label for user feedback
    let sourceHint = '🔵 SoundCloud';
    if (YT_URL_RE.test(rawQuery)) sourceHint = '🔴 YouTube';
    else if (SC_URL_RE.test(rawQuery)) sourceHint = '🔵 SoundCloud';
    else if (SP_URL_RE.test(rawQuery)) sourceHint = '🟢 Spotify';

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x1DB954)
        .setDescription(`🔍 Loading from **${sourceHint}**: \`${rawQuery.slice(0, 80)}\`...`)],
    }).catch(() => {});

    try {
      await client.distube.play(voiceChannel, rawQuery, {
        member:      interaction.member,
        textChannel: interaction.channel,
      });
      // playSong/addSong events send the real embed — no extra reply needed
    } catch (err) {
      console.error('[Play Error]', err.message);

      let msg = err.message || '';
      let suggestion = '';

      if (/sign in|bot|confirm your age|bot detected/i.test(msg)) {
        msg = 'YouTube is blocking this request.';
        suggestion = '**Try instead:**\n> Search by song name — it uses SoundCloud automatically\n> Or paste a SoundCloud link: `soundcloud.com/...`';
      } else if (/private|unavailable|removed/i.test(msg)) {
        msg = 'This track is private or unavailable.';
        suggestion = 'Try a different source or search by name.';
      } else if (/no result|not found/i.test(msg)) {
        msg = `No results found for **"${rawQuery}"**.`;
        suggestion = 'Try a more specific search term.';
      } else if (/429|rate.?limit/i.test(msg)) {
        msg = 'Rate limited. Try again in a moment.';
        suggestion = '';
      } else {
        msg = msg.slice(0, 150);
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription(`❌ ${msg}${suggestion ? '\n\n' + suggestion : ''}`);

      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  },
};
