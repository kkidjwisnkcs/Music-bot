// /play — SoundCloud search by default (never blocked), YouTube URLs still work
'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const URL_RE    = /^https?:\/\//i;
const YT_URL_RE = /youtu\.?be|youtube\.com/i;
const SC_URL_RE = /soundcloud\.com/i;

// Search SoundCloud via yt-dlp — never blocked, massive library
async function scSearch(query) {
  const safe = query.replace(/["`\\]/g, ' ').trim();
  const cmd  = `yt-dlp --no-warnings --flat-playlist --dump-json --playlist-items 1 "scsearch1:${safe}"`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: 20000 });
    const line = stdout.trim().split('\n').find(l => l.startsWith('{'));
    if (!line) throw new Error('no output');
    const data = JSON.parse(line);
    const url  = data.url || data.webpage_url;
    if (!url) throw new Error('no url');
    console.log(`[SC Search] "${query}" → ${url}`);
    return url;
  } catch (err) {
    console.warn('[SC Search] failed:', err.message, '— passing raw query to DisTube');
    return null;
  }
}

async function playWithRetry(distube, voiceChannel, query, opts, maxAttempts = 2) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await distube.play(voiceChannel, query, opts);
      return;
    } catch (err) {
      lastErr = err;
      const isVoice = /voice|connect|timeout|UDP|READY|30 second/i.test(err.message);
      if (isVoice && attempt < maxAttempts) {
        console.warn(`[Voice] Attempt ${attempt} failed — retrying in 2s`);
        try { const q = distube.getQueue(voiceChannel.guild); if (q) await q.stop(); } catch {}
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song — search by name (uses SoundCloud) or paste a YouTube/SoundCloud URL.')
    .addStringOption(o => o
      .setName('query')
      .setDescription('Song name or URL (YouTube / SoundCloud)')
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
        embeds: [new EmbedBuilder().setColor(0xED4245)
          .setDescription('❌ I need **Connect** and **Speak** permissions in that voice channel.')],
      });
    }

    const rawQuery = interaction.options.getString('query');
    const isUrl    = URL_RE.test(rawQuery);
    const isYT     = isUrl && YT_URL_RE.test(rawQuery);
    const isSC     = isUrl && SC_URL_RE.test(rawQuery);

    // Show loading state
    const sourceLabel = isYT ? '🔴 YouTube' : isSC ? '🔵 SoundCloud' : '🔵 SoundCloud (search)';
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x1DB954)
        .setDescription(`🔍 Loading via **${sourceLabel}**: \`${rawQuery.slice(0, 80)}\`...`)],
    }).catch(() => {});

    // For name searches (not URLs): resolve through SoundCloud via yt-dlp
    // For YouTube URLs: pass directly (yt-dlp handles with bypass args)
    // For SoundCloud URLs: pass directly to SoundCloud plugin
    let resolvedQuery = rawQuery;

    if (!isUrl) {
      // Search SoundCloud — free, never blocked, has everything popular
      const scUrl = await scSearch(rawQuery);
      if (scUrl) resolvedQuery = scUrl;
      // If scSearch fails, DisTube will try its own search through the plugins
    }

    try {
      await playWithRetry(client.distube, voiceChannel, resolvedQuery, {
        member:      interaction.member,
        textChannel: interaction.channel,
      });
    } catch (err) {
      console.error('[Play Error]', err.message);
      let msg = err.message || '';
      let tip  = '';

      if (/voice|connect|timeout|UDP|READY|30 second/i.test(msg)) {
        msg = 'Could not connect to voice after 2 attempts.';
        tip = 'Make sure I have **Connect** and **Speak** perms, then try again.';
      } else if (/sign in|bot|confirm your age|login required/i.test(msg)) {
        msg = 'YouTube blocked this request.';
        tip = 'Search by **song name** (uses SoundCloud) or paste a **SoundCloud link** directly.';
      } else if (/no result|not found|cannot find/i.test(msg)) {
        msg = `No results for **"${rawQuery}"**.`;
        tip = 'Try a more specific search or paste a direct URL.';
      } else if (/429|rate limit/i.test(msg)) {
        msg = 'Rate limited — try again in a moment.';
      } else if (/private|unavailable|removed/i.test(msg)) {
        msg = 'That track is private or unavailable.';
        tip = 'Try searching by name instead.';
      } else {
        msg = msg.slice(0, 200);
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245)
          .setDescription(`❌ ${msg}${tip ? '\n\n💡 ' + tip : ''}`)],
      }).catch(() => {});
    }
  },
};
