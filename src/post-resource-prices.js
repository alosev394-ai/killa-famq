import { ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';

const DIVIDER = '━━━━━━━━━━━━━━━━━━';
const PRICE_MESSAGE_ID = '1520338343726940202';

const PRICE_GROUPS = [
  {
    title: '🖼️ ИСКОПАЕМЫЕ / РЕСУРСЫ 🖼️',
    items: [
      ['🪵', 'Дерево', '2300', true],
      ['☁️', 'Камень', '4000', true],
    ],
  },
  {
    title: '💐 ЦВЕТЫ 💐',
    items: [
      ['💠', 'Синий цветок', '650', true],
      ['🌷', 'Розовый цветок', '650', true],
      ['🌹', 'Красный цветок', '650', true],
    ],
  },
  {
    title: '⬜ РАЗНОЕ ⬜',
    items: [
      ['📍', 'Метка', '3500', false],
    ],
  },
];

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
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

/**
 * Checks whether a channel is a text-like guild channel.
 * @param {import('discord.js').GuildBasedChannel} channel - Guild channel.
 * @returns {boolean} True when the channel can receive text messages.
 * @skill-verified
 */
function isTextChannel(channel) {
  return channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
}

/**
 * Checks whether a text channel looks like a prices channel.
 * @param {import('discord.js').GuildBasedChannel} channel - Guild channel.
 * @returns {boolean} True when the channel looks like the resource prices channel.
 * @skill-verified
 */
function isPricesChannel(channel) {
  const name = normalizeChannelName(channel.name);
  return name.includes('расценки')
    || name.includes('цены')
    || name.includes('цена')
    || name.includes('прайс')
    || name.includes('price');
}

/**
 * Finds the resource prices channel on the guild.
 * @param {import('discord.js').Collection<string, import('discord.js').GuildBasedChannel | null>} channels - Guild channels.
 * @returns {import('discord.js').TextChannel | import('discord.js').NewsChannel | null} Matching channel.
 * @skill-verified
 */
function findPricesChannel(channels) {
  const channelList = [...channels.values()].filter(Boolean);
  const textChannels = channelList.filter(isTextChannel);
  return textChannels.find(isPricesChannel) || null;
}

/**
 * Formats one resource price line.
 * @param {string} emoji - Resource emoji.
 * @param {string} label - Resource name.
 * @param {string} price - Resource price.
 * @param {boolean} showMoneyEmoji - Whether to append a money emoji after the price.
 * @returns {string} Formatted price line.
 * @skill-verified
 */
function formatPriceLine(emoji, label, price, showMoneyEmoji) {
  return showMoneyEmoji ? `${emoji} ${label} — ${price} 💵` : `${emoji} ${label} — ${price}`;
}

/**
 * Appends one price group to the description lines.
 * @param {string[]} lines - Mutable description lines.
 * @param {{ title: string, items: Array<[string, string, string, boolean]> }} group - Resource price group.
 * @returns {void} Does not return a value.
 * @skill-verified
 */
function appendPriceGroup(lines, group) {
  lines.push(group.title);

  for (const [emoji, label, price, showMoneyEmoji] of group.items) {
    lines.push(formatPriceLine(emoji, label, price, showMoneyEmoji));
  }

  lines.push('');
}

/**
 * Builds the resource prices description.
 * @returns {string} Embed description.
 * @skill-verified
 */
function buildResourcePricesDescription() {
  const lines = [];

  for (const group of PRICE_GROUPS) {
    appendPriceGroup(lines, group);
  }

  lines.push(DIVIDER);
  return lines.join('\n');
}

/**
 * Builds the resource prices embed.
 * @returns {EmbedBuilder} Resource prices embed.
 * @skill-verified
 */
function buildResourcePricesEmbed() {
  return new EmbedBuilder()
    .setColor(0x2fbf71)
    .setTitle('💵 ОПЛАТА ЗА РЕСУРСЫ 💵')
    .setDescription(buildResourcePricesDescription())
    .setFooter({ text: 'KILLA FAMQ • Актуальные расценки' })
    .setTimestamp();
}

/**
 * Sends or updates resource prices in the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after prices are sent or updated.
 * @skill-verified
 */
async function postResourcePrices(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to post resource prices.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const channel = findPricesChannel(channels);

  if (!channel) {
    throw new Error('Не нашел канал с расценками.');
  }

  try {
    const message = await channel.messages.fetch(PRICE_MESSAGE_ID);
    const updatedMessage = await message.edit({ embeds: [buildResourcePricesEmbed()], allowedMentions: { parse: [] } });
    console.log(`Расценки обновлены в канале #${channel.name}: ${updatedMessage.url}`);
    return;
  } catch {
    const message = await channel.send({ embeds: [buildResourcePricesEmbed()], allowedMentions: { parse: [] } });
    console.log(`Расценки отправлены в канал #${channel.name}: ${message.url}`);
  }
}

/**
 * Starts a one-time Discord client and posts resource prices after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts prices after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after prices are posted and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postResourcePrices(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
