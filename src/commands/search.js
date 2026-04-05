// /search — search SoundCloud and pick from results
'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search SoundCloud and pick from 5 results.')
    .addStringOption(o => o.setName('query').setDescription('What to search').setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({ content: '❌ Join a voice channel first!' });
    }

    const query = interaction.options.getString('query');

    try {
      // Use DisTube's built-in search — routes through SoundCloud plugin
      const results = await client.distube.search(query, { limit: 5, safeSearch: false });
      if (!results?.length) return interaction.editReply({ content: `❌ No results for "${query}".` });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🔍 Results for: ${query}`)
        .setDescription(
          results.map((r, i) =>
            `\`${i + 1}.\` **[${r.name}](${r.url})**\n> ${r.formattedDuration}  |  ${r.uploader?.name || 'Unknown'}`
          ).join('\n\n')
        )
        .setFooter({ text: 'Reply with 1–5 to pick, or "cancel" (30s timeout)' });

      await interaction.editReply({ embeds: [embed] });

      const filter = m => m.author.id === interaction.user.id;
      const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30_000 }).catch(() => null);

      if (!collected?.size) return interaction.followUp({ content: '⌛ Timed out.', ephemeral: true });

      const choice = collected.first()?.content?.trim().toLowerCase();
      collected.first()?.delete().catch(() => {});

      if (!choice || choice === 'cancel') return interaction.followUp({ content: '🔎 Cancelled.', ephemeral: true });

      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= results.length) return interaction.followUp({ content: '❌ Invalid choice.', ephemeral: true });

      await client.distube.play(voiceChannel, results[idx].url, {
        member: interaction.member, textChannel: interaction.channel,
      });

      await interaction.followUp({ content: `▶️ Queued: **${results[idx].name}**`, ephemeral: true });

    } catch (err) {
      await interaction.editReply({ content: `❌ ${err.message.slice(0, 200)}` });
    }
  },
};
