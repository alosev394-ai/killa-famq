import { ChannelType, Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';
import { buildPromotionReportButtonRow } from './form-components.js';
import { buildPromotionReportFormEmbed } from './promotion-system.js';

const FALLBACK_PROMOTION_REPORT_MESSAGE_ID = '1520873484165709826';

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
 * Checks whether a channel name looks like the promotion report channel.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Guild channel.
 * @returns {boolean} True when the channel looks like the report channel.
 * @skill-verified
 */
function isPromotionReportChannel(channel) {
  if (!channel || !isTextChannel(channel)) {
    return false;
  }

  const name = normalizeChannelName(channel.name);
  return name.includes('отчетынаповыш')
    || name.includes('отчетынаповышение')
    || (name.includes('отчет') && name.includes('повыш'));
}

/**
 * Checks whether the bot can send embeds and components into a channel.
 * @param {import('discord.js').GuildTextBasedChannel} channel - Channel to inspect.
 * @returns {Promise<boolean>} True when the bot can send the form.
 * @skill-verified
 */
async function canSendToChannel(channel) {
  const me = channel.guild.members.me || await channel.guild.members.fetchMe();
  const permissions = channel.permissionsFor(me);
  return Boolean(permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]));
}

/**
 * Finds the promotion report channel on the guild.
 * @param {import('discord.js').Guild} guild - Guild to search.
 * @returns {Promise<import('discord.js').GuildTextBasedChannel | null>} Matching channel or null.
 * @skill-verified
 */
async function findPromotionReportChannel(guild) {
  await guild.channels.fetch();

  for (const [, channel] of guild.channels.cache) {
    if (isPromotionReportChannel(channel) && await canSendToChannel(channel)) {
      return channel;
    }
  }

  return null;
}

/**
 * Sends the promotion report form to the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after the form is sent.
 * @skill-verified
 */
async function postPromotionReportForm(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to post the promotion report form.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const channel = await findPromotionReportChannel(guild);

  if (!channel) {
    throw new Error('Не нашел канал отчётов на повышение.');
  }

  const message = await sendOrEditPromotionReportForm(channel);
  console.log(`Форма отчётов на повышение обновлена в канале #${channel.name}: ${message.url}`);
}

/**
 * Sends a new promotion report form message or edits the existing one.
 * @param {import('discord.js').GuildTextBasedChannel} channel - Promotion report channel.
 * @returns {Promise<import('discord.js').Message>} Sent or edited message.
 * @skill-verified
 */
async function sendOrEditPromotionReportForm(channel) {
  const payload = {
    embeds: [buildPromotionReportFormEmbed()],
    components: [buildPromotionReportButtonRow()],
    allowedMentions: { parse: [] },
  };

  try {
    const message = await channel.messages.fetch(FALLBACK_PROMOTION_REPORT_MESSAGE_ID);
    return await message.edit(payload);
  } catch {
    return channel.send(payload);
  }
}

/**
 * Starts a one-time Discord client and posts the promotion report form after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts the report form after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after the form is posted and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postPromotionReportForm(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
