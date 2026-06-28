import { ChannelType, Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';
import { buildPromotionSystemEmbed } from './promotion-system.js';

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
 * @returns {boolean} True when the channel can receive text messages.
 * @skill-verified
 */
function isTextChannel(channel) {
  return Boolean(channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) && 'send' in channel);
}

/**
 * Checks whether a channel name looks like the promotion system channel.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Guild channel.
 * @returns {boolean} True when the channel looks like the promotion system channel.
 * @skill-verified
 */
function isPromotionSystemChannel(channel) {
  if (!channel || !isTextChannel(channel)) {
    return false;
  }

  const name = normalizeChannelName(channel.name);
  return name.includes('системаповыш') || (name.includes('система') && name.includes('повыш'));
}

/**
 * Checks whether the bot can send embeds into a channel.
 * @param {import('discord.js').GuildTextBasedChannel} channel - Channel to inspect.
 * @returns {Promise<boolean>} True when the bot can send embeds.
 * @skill-verified
 */
async function canSendToChannel(channel) {
  const me = channel.guild.members.me || await channel.guild.members.fetchMe();
  const permissions = channel.permissionsFor(me);
  return Boolean(permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]));
}

/**
 * Finds the promotion system channel on the guild.
 * @param {import('discord.js').Guild} guild - Guild to search.
 * @returns {Promise<import('discord.js').GuildTextBasedChannel | null>} Matching channel or null.
 * @skill-verified
 */
async function findPromotionSystemChannel(guild) {
  await guild.channels.fetch();

  for (const [, channel] of guild.channels.cache) {
    if (isPromotionSystemChannel(channel) && await canSendToChannel(channel)) {
      return channel;
    }
  }

  return null;
}

/**
 * Sends the promotion system to the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after the system is sent.
 * @skill-verified
 */
async function postPromotionSystem(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to post the promotion system.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const channel = await findPromotionSystemChannel(guild);

  if (!channel) {
    throw new Error('Не нашел канал системы повышения.');
  }

  const message = await channel.send({ embeds: [buildPromotionSystemEmbed()], allowedMentions: { parse: [] } });
  console.log(`Система повышения отправлена в канал #${channel.name}: ${message.url}`);
}

/**
 * Starts a one-time Discord client and posts the promotion system after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts the promotion system after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after the post is sent and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postPromotionSystem(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
