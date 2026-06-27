import { ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  getGuildPriceState,
  setGuildPriceMessageId,
  updateGuildPriceList,
} from './store.js';

const DIVIDER = '━━━━━━━━━━━━━━━━━━';
const FALLBACK_PRICE_MESSAGE_ID = '1520338343726940202';

export const PRICE_CATEGORY_CHOICES = Object.freeze([
  { name: '🖼️ ИСКОПАЕМЫЕ / РЕСУРСЫ', value: 'resources' },
  { name: '💐 ЦВЕТЫ', value: 'flowers' },
  { name: '⬜ РАЗНОЕ', value: 'other' },
]);

const PRICE_CATEGORY_TITLES = Object.freeze({
  resources: '🖼️ ИСКОПАЕМЫЕ / РЕСУРСЫ 🖼️',
  flowers: '💐 ЦВЕТЫ 💐',
  other: '⬜ РАЗНОЕ ⬜',
});

const DEFAULT_PRICE_GROUPS = Object.freeze([
  {
    id: 'resources',
    title: PRICE_CATEGORY_TITLES.resources,
    items: [
      { emoji: '🪵', name: 'Дерево', price: '2300', money: true },
      { emoji: '☁️', name: 'Камень', price: '4000', money: true },
    ],
  },
  {
    id: 'flowers',
    title: PRICE_CATEGORY_TITLES.flowers,
    items: [
      { emoji: '💠', name: 'Синий цветок', price: '650', money: true },
      { emoji: '🌷', name: 'Розовый цветок', price: '650', money: true },
      { emoji: '🌹', name: 'Красный цветок', price: '650', money: true },
    ],
  },
  {
    id: 'other',
    title: PRICE_CATEGORY_TITLES.other,
    items: [
      { emoji: '📍', name: 'Метка', price: '3500', money: false },
    ],
  },
]);

/**
 * Creates a fresh default price list.
 * @returns {{ groups: Array<{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }>, updatedAt: string | null, updatedById: string | null }} Default price list.
 * @skill-verified
 */
function createDefaultPriceList() {
  return {
    groups: DEFAULT_PRICE_GROUPS.map(clonePriceGroup),
    updatedAt: null,
    updatedById: null,
  };
}

/**
 * Clones one price group.
 * @param {{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }} group - Price group to clone.
 * @returns {{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }} Cloned price group.
 * @skill-verified
 */
function clonePriceGroup(group) {
  return {
    id: group.id,
    title: group.title,
    items: group.items.map(clonePriceItem),
  };
}

/**
 * Clones one price item.
 * @param {{ emoji: string, name: string, price: string, money: boolean }} item - Price item to clone.
 * @returns {{ emoji: string, name: string, price: string, money: boolean }} Cloned price item.
 * @skill-verified
 */
function clonePriceItem(item) {
  return {
    emoji: item.emoji,
    name: item.name,
    price: item.price,
    money: item.money,
  };
}

/**
 * Normalizes a saved price list or builds the default list.
 * @param {Record<string, unknown> | undefined} value - Saved price list value.
 * @returns {{ groups: Array<{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }>, updatedAt: string | null, updatedById: string | null }} Normalized price list.
 * @skill-verified
 */
export function normalizePriceList(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.groups)) {
    return createDefaultPriceList();
  }

  const groups = value.groups
    .map(normalizePriceGroup)
    .filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return createDefaultPriceList();
  }

  return {
    groups,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    updatedById: typeof value.updatedById === 'string' ? value.updatedById : null,
  };
}

/**
 * Normalizes one saved price group.
 * @param {unknown} value - Saved price group value.
 * @returns {{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }} Normalized price group.
 * @skill-verified
 */
function normalizePriceGroup(value) {
  const group = value && typeof value === 'object' ? value : {};
  const rawId = 'id' in group && typeof group.id === 'string' ? group.id : 'other';
  const id = PRICE_CATEGORY_TITLES[rawId] ? rawId : 'other';
  const title = 'title' in group && typeof group.title === 'string' && group.title.trim()
    ? group.title.trim()
    : PRICE_CATEGORY_TITLES[id];
  const rawItems = 'items' in group && Array.isArray(group.items) ? group.items : [];

  return {
    id,
    title,
    items: rawItems.map(normalizePriceItem).filter(Boolean),
  };
}

/**
 * Normalizes one saved price item.
 * @param {unknown} value - Saved price item value.
 * @returns {{ emoji: string, name: string, price: string, money: boolean } | null} Normalized price item or null.
 * @skill-verified
 */
function normalizePriceItem(value) {
  const item = value && typeof value === 'object' ? value : {};
  const name = 'name' in item && typeof item.name === 'string' ? item.name.trim() : '';
  const price = 'price' in item && typeof item.price === 'string' ? item.price.trim() : '';

  if (!name || !price) {
    return null;
  }

  return {
    emoji: 'emoji' in item && typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim() : '▫️',
    name,
    price,
    money: !('money' in item) || typeof item.money !== 'boolean' ? true : item.money,
  };
}

/**
 * Reads the current guild price list.
 * @param {string} guildId - Discord guild ID.
 * @returns {Promise<{ groups: Array<{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }>, updatedAt: string | null, updatedById: string | null }>} Price list.
 * @skill-verified
 */
export async function getGuildPriceList(guildId) {
  const priceState = await getGuildPriceState(guildId);
  return normalizePriceList(priceState.priceList);
}

/**
 * Updates one existing resource price.
 * @param {string} guildId - Discord guild ID.
 * @param {string} itemName - Resource name to update.
 * @param {{ price: string, emoji?: string | null, updatedById: string }} data - Update data.
 * @returns {Promise<{ priceList: Record<string, unknown>, item: { emoji: string, name: string, price: string, money: boolean }, oldPrice: string }>} Update result.
 * @skill-verified
 */
export function updateGuildPriceItem(guildId, itemName, data) {
  /**
   * Updates one price item inside the stored price list.
   * @param {Record<string, unknown>} savedPriceList - Saved price list.
   * @returns {{ priceList: Record<string, unknown>, item: { emoji: string, name: string, price: string, money: boolean }, oldPrice: string }} Update result.
   * @skill-verified
   */
  function updatePriceItem(savedPriceList) {
    const priceList = normalizePriceList(savedPriceList);
    const match = findPriceItem(priceList, itemName);

    if (!match) {
      throw new Error(`Не нашел ресурс: ${itemName}`);
    }

    const oldPrice = match.item.price;
    match.item.price = normalizePriceValue(data.price);

    if (data.emoji) {
      match.item.emoji = data.emoji.trim();
    }

    markPriceListUpdated(priceList, data.updatedById);
    replaceObjectContents(savedPriceList, priceList);

    return { priceList, item: match.item, oldPrice };
  }

  return updateGuildPriceList(guildId, updatePriceItem);
}

/**
 * Adds one resource to the price list.
 * @param {string} guildId - Discord guild ID.
 * @param {{ categoryId: string, name: string, price: string, emoji?: string | null, money: boolean, updatedById: string }} data - New resource data.
 * @returns {Promise<{ priceList: Record<string, unknown>, item: { emoji: string, name: string, price: string, money: boolean }, groupTitle: string }>} Add result.
 * @skill-verified
 */
export function addGuildPriceItem(guildId, data) {
  /**
   * Adds one price item inside the stored price list.
   * @param {Record<string, unknown>} savedPriceList - Saved price list.
   * @returns {{ priceList: Record<string, unknown>, item: { emoji: string, name: string, price: string, money: boolean }, groupTitle: string }} Add result.
   * @skill-verified
   */
  function addPriceItem(savedPriceList) {
    const priceList = normalizePriceList(savedPriceList);

    if (findPriceItem(priceList, data.name)) {
      throw new Error(`Такой ресурс уже есть: ${data.name}`);
    }

    const group = ensurePriceGroup(priceList, data.categoryId);
    const item = {
      emoji: data.emoji?.trim() || '▫️',
      name: data.name.trim(),
      price: normalizePriceValue(data.price),
      money: data.money,
    };

    group.items.push(item);
    markPriceListUpdated(priceList, data.updatedById);
    replaceObjectContents(savedPriceList, priceList);

    return { priceList, item, groupTitle: group.title };
  }

  return updateGuildPriceList(guildId, addPriceItem);
}

/**
 * Removes one resource from the price list.
 * @param {string} guildId - Discord guild ID.
 * @param {string} itemName - Resource name to remove.
 * @param {string} updatedById - Discord user ID of the updater.
 * @returns {Promise<{ priceList: Record<string, unknown>, item: { emoji: string, name: string, price: string, money: boolean }, groupTitle: string }>} Remove result.
 * @skill-verified
 */
export function removeGuildPriceItem(guildId, itemName, updatedById) {
  /**
   * Removes one price item inside the stored price list.
   * @param {Record<string, unknown>} savedPriceList - Saved price list.
   * @returns {{ priceList: Record<string, unknown>, item: { emoji: string, name: string, price: string, money: boolean }, groupTitle: string }} Remove result.
   * @skill-verified
   */
  function removePriceItem(savedPriceList) {
    const priceList = normalizePriceList(savedPriceList);
    const match = findPriceItem(priceList, itemName);

    if (!match) {
      throw new Error(`Не нашел ресурс: ${itemName}`);
    }

    const [item] = match.group.items.splice(match.index, 1);
    markPriceListUpdated(priceList, updatedById);
    replaceObjectContents(savedPriceList, priceList);

    return { priceList, item, groupTitle: match.group.title };
  }

  return updateGuildPriceList(guildId, removePriceItem);
}

/**
 * Publishes or updates the guild price list message.
 * @param {import('discord.js').Guild} guild - Guild that owns the price list.
 * @param {{ channel?: import('discord.js').GuildTextBasedChannel | null, priceList?: Record<string, unknown> }} options - Publish options.
 * @returns {Promise<{ message: import('discord.js').Message, channel: import('discord.js').GuildTextBasedChannel, priceList: Record<string, unknown> }>} Publish result.
 * @skill-verified
 */
export async function publishGuildPriceList(guild, options = {}) {
  const priceState = await getGuildPriceState(guild.id);
  const priceList = normalizePriceList(options.priceList || priceState.priceList);
  const channel = options.channel || await findPricesChannel(guild);

  if (!channel) {
    throw new Error('Не нашел канал с расценками.');
  }

  const messageId = priceState.priceMessageId || FALLBACK_PRICE_MESSAGE_ID;
  const embed = buildPriceListEmbed(priceList);
  const message = await sendOrEditPriceMessage(channel, messageId, embed);
  await setGuildPriceMessageId(guild.id, message.id);

  return { message, channel, priceList };
}

/**
 * Builds the price list embed.
 * @param {Record<string, unknown>} rawPriceList - Price list data.
 * @returns {EmbedBuilder} Price list embed.
 * @skill-verified
 */
export function buildPriceListEmbed(rawPriceList) {
  const priceList = normalizePriceList(rawPriceList);

  return new EmbedBuilder()
    .setColor(0x2fbf71)
    .setTitle('💵 ОПЛАТА ЗА РЕСУРСЫ 💵')
    .setDescription(buildPriceListDescription(priceList))
    .setFooter({ text: 'KILLA FAMQ • Актуальные расценки' })
    .setTimestamp();
}

/**
 * Builds the price list embed description.
 * @param {{ groups: Array<{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }>, updatedAt: string | null, updatedById: string | null }} priceList - Price list data.
 * @returns {string} Embed description.
 * @skill-verified
 */
function buildPriceListDescription(priceList) {
  const lines = [];

  for (const group of priceList.groups) {
    if (group.items.length === 0) {
      continue;
    }

    appendPriceGroup(lines, group);
  }

  lines.push(DIVIDER);

  if (priceList.updatedAt) {
    lines.push(`Обновлено: ${formatDiscordTimestamp(priceList.updatedAt)}`);
  }

  if (priceList.updatedById) {
    lines.push(`Обновил: <@${priceList.updatedById}>`);
  }

  return lines.join('\n');
}

/**
 * Appends one price group to the description lines.
 * @param {string[]} lines - Mutable description lines.
 * @param {{ title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }} group - Resource price group.
 * @returns {void}
 * @skill-verified
 */
function appendPriceGroup(lines, group) {
  lines.push(group.title);

  for (const item of group.items) {
    lines.push(formatPriceLine(item));
  }

  lines.push('');
}

/**
 * Formats one price line.
 * @param {{ emoji: string, name: string, price: string, money: boolean }} item - Price item.
 * @returns {string} Formatted price line.
 * @skill-verified
 */
function formatPriceLine(item) {
  return item.money ? `${item.emoji} ${item.name} — ${item.price} 💵` : `${item.emoji} ${item.name} — ${item.price}`;
}

/**
 * Finds a price item by resource name.
 * @param {{ groups: Array<{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }> }} priceList - Price list.
 * @param {string} itemName - Resource name to find.
 * @returns {{ group: { id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }, item: { emoji: string, name: string, price: string, money: boolean }, index: number } | null} Matching item or null.
 * @skill-verified
 */
function findPriceItem(priceList, itemName) {
  const targetName = normalizePriceName(itemName);

  for (const group of priceList.groups) {
    for (let index = 0; index < group.items.length; index += 1) {
      const item = group.items[index];

      if (normalizePriceName(item.name) === targetName) {
        return { group, item, index };
      }
    }
  }

  return null;
}

/**
 * Ensures a price category group exists.
 * @param {{ groups: Array<{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }> }} priceList - Price list.
 * @param {string} categoryId - Category ID.
 * @returns {{ id: string, title: string, items: Array<{ emoji: string, name: string, price: string, money: boolean }> }} Matching group.
 * @skill-verified
 */
function ensurePriceGroup(priceList, categoryId) {
  const safeCategoryId = PRICE_CATEGORY_TITLES[categoryId] ? categoryId : 'other';
  const existingGroup = priceList.groups.find((group) => group.id === safeCategoryId);

  if (existingGroup) {
    return existingGroup;
  }

  const group = { id: safeCategoryId, title: PRICE_CATEGORY_TITLES[safeCategoryId], items: [] };
  priceList.groups.push(group);
  return group;
}

/**
 * Marks the price list as updated by a Discord user.
 * @param {{ updatedAt: string | null, updatedById: string | null }} priceList - Price list to mark.
 * @param {string} updatedById - Discord user ID.
 * @returns {void}
 * @skill-verified
 */
function markPriceListUpdated(priceList, updatedById) {
  priceList.updatedAt = new Date().toISOString();
  priceList.updatedById = updatedById;
}

/**
 * Replaces all enumerable keys of an object.
 * @param {Record<string, unknown>} target - Object to mutate.
 * @param {Record<string, unknown>} source - Object to copy from.
 * @returns {void}
 * @skill-verified
 */
function replaceObjectContents(target, source) {
  for (const key of Object.keys(target)) {
    delete target[key];
  }

  Object.assign(target, source);
}

/**
 * Normalizes a resource name for matching.
 * @param {string} value - Raw resource name.
 * @returns {string} Normalized resource name.
 * @skill-verified
 */
function normalizePriceName(value) {
  return value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes a displayed price value.
 * @param {string} value - Raw price value.
 * @returns {string} Normalized price value.
 * @skill-verified
 */
function normalizePriceValue(value) {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Finds a guild channel that looks like the prices channel.
 * @param {import('discord.js').Guild} guild - Guild to search.
 * @returns {Promise<import('discord.js').GuildTextBasedChannel | null>} Matching channel or null.
 * @skill-verified
 */
async function findPricesChannel(guild) {
  await guild.channels.fetch();

  for (const [, channel] of guild.channels.cache) {
    if (isPricesChannel(channel) && await canSendToChannel(channel)) {
      return channel;
    }
  }

  return null;
}

/**
 * Checks whether a channel name looks like the prices channel.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Channel to inspect.
 * @returns {boolean} True when the channel looks like a prices channel.
 * @skill-verified
 */
function isPricesChannel(channel) {
  if (!channel || !isTextChannel(channel)) {
    return false;
  }

  const name = normalizeChannelName(channel.name);
  return name.includes('расценки')
    || name.includes('цены')
    || name.includes('цена')
    || name.includes('прайс')
    || name.includes('price');
}

/**
 * Checks whether a channel is a text-like guild channel.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Channel to inspect.
 * @returns {boolean} True when the channel can receive text messages.
 * @skill-verified
 */
function isTextChannel(channel) {
  return Boolean(channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) && 'send' in channel);
}

/**
 * Checks whether the bot can send embeds into a channel.
 * @param {import('discord.js').GuildTextBasedChannel} channel - Channel to inspect.
 * @returns {Promise<boolean>} True when the bot can send price embeds.
 * @skill-verified
 */
async function canSendToChannel(channel) {
  const me = channel.guild.members.me || await channel.guild.members.fetchMe();
  const permissions = channel.permissionsFor(me);
  return Boolean(permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]));
}

/**
 * Sends a new price message or edits the existing one.
 * @param {import('discord.js').GuildTextBasedChannel} channel - Prices channel.
 * @param {string} messageId - Existing message ID to try first.
 * @param {EmbedBuilder} embed - Price list embed.
 * @returns {Promise<import('discord.js').Message>} Sent or edited message.
 * @skill-verified
 */
async function sendOrEditPriceMessage(channel, messageId, embed) {
  try {
    const message = await channel.messages.fetch(messageId);
    return await message.edit({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch {
    return channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  }
}

/**
 * Normalizes a Discord channel name for fuzzy matching.
 * @param {string} value - Raw channel name.
 * @returns {string} Normalized channel name.
 * @skill-verified
 */
function normalizeChannelName(value) {
  return value.toLowerCase().normalize('NFKC').replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

/**
 * Formats an ISO date as a Discord timestamp.
 * @param {string} value - ISO date string.
 * @returns {string} Discord timestamp markup.
 * @skill-verified
 */
function formatDiscordTimestamp(value) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return `<t:${Math.floor(timestamp / 1000)}:f>`;
}
