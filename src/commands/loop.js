const { SlashCommandBuilder } = require('discord.js');
const { RepeatMode } = require('distube');
module.exports = {
  data: new SlashCommandBuilder().setName('loop').setDescription('Set loop mode')
    .addStringOption(o => o.setName('mode').setDescription('Loop mode').setRequired(true)
      .addChoices(
        { name: '🔴 Off', value: 'off' },
        { name: '🔂 Song', value: 'song' },
        { name: '🔁 Queue', value: 'queue' },
      )),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);
    if (!queue) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    const mode = interaction.options.getString('mode');
    const modeMap = { off: RepeatMode.DISABLED, song: RepeatMode.SONG, queue: RepeatMode.QUEUE };
    queue.setRepeatMode(modeMap[mode]);
    const icons = { off: '🔴', song: '🔂', queue: '🔁' };
    interaction.reply(`${icons[mode]} Loop mode set to **${mode}**`);
  },
};
