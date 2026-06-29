import { ChannelType, Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';

/**
 * Normalizes a Discord channel name for fuzzy matching.
 * @param {string} value - Raw channel name.
 * @returns {string} Normalized channel name.
 * @skill-verified
 */
function normalizeChannelName(value) {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/ё/g, 'е')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

/**
 * Checks whether a channel is a text-like guild channel.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Guild channel.
 * @returns {boolean} True when the channel can contain the old form.
 * @skill-verified
 */
function isTextChannel(channel) {
  return Boolean(channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement));
}

/**
 * Checks whether a channel looks like the old role request channel.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Guild channel.
 * @returns {boolean} True when the channel is safe to delete as the old role request channel.
 * @skill-verified
 */
function isOldRoleRequestChannel(channel) {
  if (!channel || !isTextChannel(channel)) {
    return false;
  }

  const name = normalizeChannelName(channel.name);
  return name.includes('подач') && (name.includes('роль') || name.includes('роли'));
}

/**
 * Finds the old role request channel.
 * @param {import('discord.js').Guild} guild - Guild to search.
 * @returns {Promise<import('discord.js').GuildTextBasedChannel | null>} Matching channel or null.
 * @skill-verified
 */
async function findOldRoleRequestChannel(guild) {
  await guild.channels.fetch();

  for (const [, channel] of guild.channels.cache) {
    if (isOldRoleRequestChannel(channel)) {
      return channel;
    }
  }

  return null;
}

/**
 * Deletes the old role request channel from the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after the channel is deleted or skipped.
 * @skill-verified
 */
async function deleteOldRoleFormChannel(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to delete the old role form channel.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const me = guild.members.me || await guild.members.fetchMe();

  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('Боту нужно право Управлять каналами, чтобы удалить старый канал.');
  }

  const channel = await findOldRoleRequestChannel(guild);

  if (!channel) {
    console.log('Старый канал подачи роли не найден, удалять нечего.');
    return;
  }

  const channelName = channel.name;
  await channel.delete('Удаление старой формы получения роли');
  console.log(`Старый канал подачи роли удален: #${channelName}`);
}

/**
 * Starts a one-time Discord client and deletes the old role form channel after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Deletes the old form channel after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after deletion and client shutdown.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await deleteOldRoleFormChannel(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
