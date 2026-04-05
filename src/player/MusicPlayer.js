const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
} = require('@discordjs/voice');
const playdl = require('play-dl');

class MusicPlayer {
  constructor(guildId) {
    this.guildId = guildId;
    this.queue = [];
    this.currentSong = null;
    this.audioPlayer = createAudioPlayer();
    this.connection = null;
    this.volume = 0.5;
    this.loop = 'off'; // 'off', 'song', 'queue'
    this.textChannel = null;
    this._currentResource = null;

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this._playNext().catch(console.error);
    });

    this.audioPlayer.on('error', (err) => {
      console.error('[AudioPlayer Error]', err.message);
      if (this.textChannel) {
        this.textChannel.send(`⚠️ Audio error: ${err.message}. Skipping...`).catch(() => {});
      }
      this._playNext().catch(console.error);
    });
  }

  async join(voiceChannel) {
    // If already connected to correct channel, reuse
    if (
      this.connection &&
      this.connection.state.status !== VoiceConnectionStatus.Destroyed &&
      this.connection.joinConfig.channelId === voiceChannel.id
    ) {
      return this;
    }

    // Destroy old connection if exists
    if (this.connection) {
      try { this.connection.destroy(); } catch {}
      this.connection = null;
    }

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (err) {
      this.connection.destroy();
      this.connection = null;
      throw new Error('Could not connect to voice channel. Check my permissions!');
    }

    this.connection.subscribe(this.audioPlayer);

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.connection = null;
    });

    return this;
  }

  async addSong(query, requestedBy) {
    let songInfo;

    try {
      const ytValidate = playdl.yt_validate(query);

      if (ytValidate === 'video') {
        const info = await playdl.video_info(query);
        const v = info.video_details;
        songInfo = {
          title: v.title || 'Unknown',
          url: v.url,
          thumbnail: v.thumbnails?.pop()?.url || null,
          duration: this._formatDuration(v.durationInSec),
          durationSec: v.durationInSec || 0,
          requestedBy,
        };
      } else if (ytValidate === 'playlist') {
        const playlist = await playdl.playlist_info(query, { incomplete: true });
        const videos = await playlist.all_videos();
        const songs = videos.map(v => ({
          title: v.title || 'Unknown',
          url: v.url,
          thumbnail: v.thumbnails?.pop()?.url || null,
          duration: this._formatDuration(v.durationInSec),
          durationSec: v.durationInSec || 0,
          requestedBy,
        }));
        this.queue.push(...songs);
        return { playlist: true, count: songs.length, first: songs[0] };
      } else {
        // Search YouTube
        const results = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
        if (!results.length) throw new Error('No results found for that search.');
        const v = results[0];
        songInfo = {
          title: v.title || 'Unknown',
          url: v.url,
          thumbnail: v.thumbnails?.pop()?.url || null,
          duration: this._formatDuration(v.durationInSec),
          durationSec: v.durationInSec || 0,
          requestedBy,
        };
      }
    } catch (err) {
      throw new Error(`Search failed: ${err.message}`);
    }

    this.queue.push(songInfo);
    return songInfo;
  }

  async start() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Idle && this.queue.length > 0) {
      await this._playNext();
    }
  }

  async _playNext() {
    if (this.loop === 'song' && this.currentSong) {
      this.queue.unshift(this.currentSong);
    } else if (this.loop === 'queue' && this.currentSong) {
      this.queue.push(this.currentSong);
    }

    if (!this.queue.length) {
      this.currentSong = null;
      if (this.textChannel) {
        this.textChannel.send('✅ Queue finished! Add more songs with `/play`.').catch(() => {});
      }
      return;
    }

    this.currentSong = this.queue.shift();
    await this._stream(this.currentSong);
  }

  async _stream(song) {
    try {
      const stream = await playdl.stream(song.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      resource.volume.setVolume(this.volume);
      this._currentResource = resource;
      this.audioPlayer.play(resource);

      if (this.textChannel) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setColor(0x1DB954)
          .setAuthor({ name: '🎵 Now Playing' })
          .setTitle(song.title)
          .setURL(song.url)
          .setDescription(`Duration: **${song.duration}** | Requested by: ${song.requestedBy}`)
          .setFooter({ text: `Queue: ${this.queue.length} song(s) remaining | Loop: ${this.loop}` });
        if (song.thumbnail) embed.setThumbnail(song.thumbnail);
        this.textChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      console.error('[Stream Error]', err.message);
      if (this.textChannel) {
        this.textChannel.send(`❌ Could not play **${song.title}**: ${err.message}. Skipping...`).catch(() => {});
      }
      setTimeout(() => this._playNext().catch(console.error), 1000);
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, vol)) / 100;
    if (this._currentResource?.volume) {
      this._currentResource.volume.setVolume(this.volume);
    }
  }

  pause() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
      this.audioPlayer.pause();
      return true;
    }
    return false;
  }

  resume() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      this.audioPlayer.unpause();
      return true;
    }
    return false;
  }

  skip() {
    this.audioPlayer.stop();
  }

  stop() {
    this.queue = [];
    this.currentSong = null;
    this.loop = 'off';
    this._currentResource = null;
    this.audioPlayer.stop(true);
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  remove(index) {
    if (index < 0 || index >= this.queue.length) return null;
    return this.queue.splice(index, 1)[0];
  }

  destroy() {
    this.stop();
    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      try { this.connection.destroy(); } catch {}
    }
    this.connection = null;
  }

  get isPlaying() {
    return this.audioPlayer.state.status === AudioPlayerStatus.Playing;
  }

  get isPaused() {
    return this.audioPlayer.state.status === AudioPlayerStatus.Paused;
  }

  _formatDuration(sec) {
    if (!sec || sec === 0) return 'Live';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}

module.exports = MusicPlayer;
