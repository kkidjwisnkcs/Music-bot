const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist from YouTube')
    .addStringOption(o => o.setName('query').setDescription('Song name or YouTube URL').setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) return interaction.editReply('❌ Join a voice channel first!');

    const query = interaction.options.getString('query');
    try {
      await client.distube.play(voiceChannel, query, {
        member: interaction.member,
        textChannel: interaction.channel,
        interaction,
      });
      // playSong / addSong events handle the reply embed
      if (!interaction.replied) await interaction.editReply('▶️ Processing...').catch(() => {});
    } catch (err) {
      console.error('[Play Error]', err.message);
      await interaction.editReply(`❌ ${err.message}`);
    }
  },
};
