'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song — name, YouTube URL, SoundCloud URL, or Spotify link.')
    .addStringOption(o => o
      .setName('query')
      .setDescription('Song name or URL')
      .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const vc = interaction.member.voice?.channel;
    if (!vc) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Join a voice channel first.')],
      });
    }

    const perms = vc.permissionsFor(interaction.guild.members.me);
    if (!perms?.has('Connect') || !perms?.has('Speak')) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245)
          .setDescription('❌ I need **Connect** and **Speak** permissions in that voice channel.')],
      });
    }

    const query = interaction.options.getString('query');

    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x1DB954).setDescription(`🔍 Loading: \`${query.slice(0, 80)}\`...`)],
    }).catch(() => {});

    try {
      await client.distube.play(vc, query, {
        member: interaction.member,
        textChannel: interaction.channel,
      });
    } catch (err) {
      console.error('[Play]', err.message);
      let msg = err.message || '';
      if (/sign in|bot|age|login/i.test(msg))
        msg = 'YouTube blocked this. Try searching by name, or use a SoundCloud/Spotify link.';
      else if (/no result|not found/i.test(msg))
        msg = `No results for **"${query}"**. Try a different search.`;
      else if (/private|unavailable/i.test(msg))
        msg = 'This track is private or unavailable.';
      else if (/rate|429/i.test(msg))
        msg = 'Rate limited — try again in a moment.';
      else
        msg = msg.slice(0, 250);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${msg}`)],
      }).catch(() => {});
    }
  },
};
