'use strict';
  const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  async function scSearch(query, limit = 5) {
    // Use yt-dlp to search SoundCloud and get JSON metadata
    const cmd = `yt-dlp --no-warnings --flat-playlist --dump-json --playlist-items 1-${limit} "scsearch${limit}:${query.replace(/"/g, '')}" 2>/dev/null`;
    try {
      const { stdout } = await execAsync(cmd, { timeout: 20000 });
      return stdout.trim().split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  module.exports = {
    data: new SlashCommandBuilder()
      .setName('search')
      .setDescription('Search SoundCloud and pick from up to 5 results.')
      .addStringOption(o => o.setName('query').setDescription('What to search for').setRequired(true)),

    async execute(interaction, client) {
      await interaction.deferReply({ ephemeral: true });
      const query       = interaction.options.getString('query');
      const voiceChannel = interaction.member.voice?.channel;

      if (!voiceChannel) return interaction.editReply({ content: '❌ Join a voice channel first!' });

      await interaction.editReply({ content: `🔍 Searching SoundCloud for **"${query}"**...` });

      const results = await scSearch(query, 5);
      if (!results.length) return interaction.editReply({ content: `❌ No SoundCloud results for "${query}". Try \`/play ${query}\` instead.` });

      const embed = new EmbedBuilder()
        .setColor(0xFF5500)
        .setTitle(`🔍 SoundCloud Results: ${query}`)
        .setDescription(
          results.map((r, i) => {
            const dur = r.duration ? `${Math.floor(r.duration / 60)}:${String(Math.floor(r.duration % 60)).padStart(2,'0')}` : '?:??';
            return `\`${i + 1}.\` **${r.title || 'Unknown'}**\n> ${dur} | ${r.uploader || r.channel || 'Unknown'}`;
          }).join('\n\n')
        )
        .setFooter({ text: 'Reply with 1–' + results.length + ' to pick, or "cancel" (30s timeout)' });

      await interaction.editReply({ embeds: [embed] });

      const filter = m => m.author.id === interaction.user.id;
      const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30_000 }).catch(() => null);
      if (!collected?.size) return interaction.followUp({ content: '⌛ Search timed out.', ephemeral: true });

      const choice = collected.first()?.content?.trim().toLowerCase();
      collected.first()?.delete().catch(() => {});

      if (!choice || choice === 'cancel') return interaction.followUp({ content: '🔎 Cancelled.', ephemeral: true });

      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= results.length) return interaction.followUp({ content: '❌ Invalid choice.', ephemeral: true });

      const selected = results[idx];
      const url = selected.url || selected.webpage_url;
      if (!url) return interaction.followUp({ content: '❌ Could not get URL for that result.', ephemeral: true });

      try {
        await client.distube.play(voiceChannel, url, { member: interaction.member, textChannel: interaction.channel });
      } catch (err) {
        console.error('[Search Play Error]', err.message);
        interaction.followUp({ content: `❌ ${err.message.slice(0, 200)}`, ephemeral: true });
      }
    },
  };
  