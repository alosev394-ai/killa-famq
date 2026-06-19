import { ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';
import { buildSalesLotButtonRow } from './form-components.js';

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
 * Checks whether a channel name looks like a sales channel.
 * @param {import('discord.js').GuildBasedChannel} channel - Guild channel.
 * @returns {boolean} True when the channel looks like the sales channel.
 * @skill-verified
 */
function isSalesChannel(channel) {
  const name = normalizeChannelName(channel.name);
  return name.includes('продажи') || name.includes('продажа') || name.includes('sales');
}

/**
 * Finds the sales channel on the guild.
 * @param {import('discord.js').Collection<string, import('discord.js').GuildBasedChannel | null>} channels - Guild channels.
 * @returns {import('discord.js').TextChannel | import('discord.js').NewsChannel | null} Matching channel.
 * @skill-verified
 */
function findSalesChannel(channels) {
  const channelList = [...channels.values()].filter(Boolean);
  const textChannels = channelList.filter(isTextChannel);
  return textChannels.find(isSalesChannel) || null;
}

/**
 * Builds the sales form embed.
 * @returns {EmbedBuilder} Sales form embed.
 * @skill-verified
 */
function buildSalesFormEmbed() {
  return new EmbedBuilder()
    .setColor(0x2fbf71)
    .setTitle('💸 Продажа имущества и вещей')
    .setDescription([
      'Для продажи имущества/вещей составь сообщение строго по форме:',
      '',
      '**Товар:**',
      '**Цена:**',
      '**Описание (если нужно):**',
      '**Скрин:**',
      '',
      'Сообщения не по форме могут быть удалены администрацией.',
    ].join('\n'))
    .setFooter({ text: 'KILLA FAMQ • Торговая площадка' })
    .setTimestamp();
}

/**
 * Sends the sales form to the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after the form is sent.
 * @skill-verified
 */
async function postSalesForm(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to post the sales form.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const channel = findSalesChannel(channels);

  if (!channel) {
    throw new Error('Не нашел канал продаж.');
  }

  const message = await channel.send({ embeds: [buildSalesFormEmbed()], components: [buildSalesLotButtonRow()], allowedMentions: { parse: [] } });
  console.log(`Форма продаж отправлена в канал #${channel.name}: ${message.url}`);
}

/**
 * Starts a one-time Discord client and posts the sales form after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts the sales form after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after the form is posted and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postSalesForm(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
