'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

function fetchLyrics(artist, title) {
  return new Promise((resolve) => {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    https.get(url, { headers: { 'User-Agent': 'MusicBot/1.0' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data).lyrics || null); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Get lyrics for the current song or any song.')
    .addStringOption(o => o.setName('query').setDescription('Song name (leave empty for current song)').setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply();
    let search = interaction.options.getString('query');
    if (!search) {
      const queue = client.distube.getQueue(interaction.guild);
      if (!queue) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Nothing is playing!')] });
      search = queue.songs[0].name;
    }

    // Parse "Artist - Title" format
    let artist = '', title = search;
    if (search.includes(' - ')) {
      [artist, title] = search.split(' - ', 2);
    }
    // Strip noise words
    title = title.replace(/\(official.*?\)|\[official.*?\]|official|video|audio|lyrics|hd|4k|mv/gi, '').trim();
    artist = artist.trim();

    const lyrics = artist
      ? await fetchLyrics(artist, title) || await fetchLyrics('', search)
      : await fetchLyrics('', search);

    if (!lyrics) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ Lyrics not found for **"${search}"**.\nTry: \`/lyrics query:Artist - Song Title\``)],
      });
    }

    const chunks = [];
    for (let i = 0; i < Math.min(lyrics.length, 10000); i += 3900) {
      chunks.push(lyrics.slice(i, i + 3900));
    }

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle(`🎵 ${title}`)
      .setDescription(chunks[0])
      .setFooter({ text: chunks.length > 1 ? `Part 1/${chunks.length}  ·  via lyrics.ovh` : 'via lyrics.ovh' });
    if (artist) embed.setAuthor({ name: artist });

    await interaction.editReply({ embeds: [embed] });
  },
};
