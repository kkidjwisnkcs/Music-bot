const MusicPlayer = require('../player/MusicPlayer');

function getOrCreatePlayer(client, guildId) {
  if (!client.queues.has(guildId)) {
    client.queues.set(guildId, new MusicPlayer(guildId));
  }
  return client.queues.get(guildId);
}

function getPlayer(client, guildId) {
  return client.queues.get(guildId) || null;
}

module.exports = { getOrCreatePlayer, getPlayer };
