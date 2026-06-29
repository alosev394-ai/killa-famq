import { ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';
import { buildMembershipRequestButtonRow } from './form-components.js';

const MEMBERSHIP_FORM_FOOTER = 'KILLA FAMQ • Заявки в семью/корпу';

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
 * Checks whether a channel or its parent belongs to the archive area.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Guild channel.
 * @returns {boolean} True when the channel is archival.
 * @skill-verified
 */
function isArchiveArea(channel) {
  if (!channel) {
    return false;
  }

  const channelName = normalizeChannelName(channel.name);
  const parentName = channel.parent ? normalizeChannelName(channel.parent.name) : '';
  return channelName.includes('архив') || channelName.includes('archive') || parentName.includes('архив') || parentName.includes('archive');
}

/**
 * Checks whether a channel name looks like the membership request channel.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Guild channel.
 * @returns {boolean} True when the channel looks like the membership request channel.
 * @skill-verified
 */
function isMembershipRequestChannel(channel) {
  if (!channel || !isTextChannel(channel) || isArchiveArea(channel)) {
    return false;
  }

  const name = normalizeChannelName(channel.name);
  return name.includes('заявк')
    && (name.includes('сем') || name.includes('family'))
    && (name.includes('корп') || name.includes('карп') || name.includes('corp'));
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
 * Finds the membership request channel on the guild.
 * @param {import('discord.js').Guild} guild - Guild to search.
 * @returns {Promise<import('discord.js').GuildTextBasedChannel | null>} Matching channel or null.
 * @skill-verified
 */
async function findMembershipRequestChannel(guild) {
  await guild.channels.fetch();

  for (const [, channel] of guild.channels.cache) {
    if (isMembershipRequestChannel(channel) && await canSendToChannel(channel)) {
      return channel;
    }
  }

  return null;
}

/**
 * Builds the membership request form embed.
 * @returns {EmbedBuilder} Membership request form embed.
 * @skill-verified
 */
function buildMembershipFormEmbed() {
  return new EmbedBuilder()
    .setColor(0x2fbf71)
    .setTitle('🟣 Заявка в семью / корпу')
    .setDescription([
      'Выбери, куда хочешь подать заявку, и заполни форму.',
      '',
      '**В форме будет:**',
      '🎮 Игровой ник',
      '🆔 CID',
      '💬 Почему хотите вступить к нам',
      '',
      'После отправки бот создаст отдельный приватный чат заявки.',
    ].join('\n'))
    .setFooter({ text: MEMBERSHIP_FORM_FOOTER })
    .setTimestamp();
}

/**
 * Finds an existing membership form message from the bot.
 * @param {import('discord.js').GuildTextBasedChannel} channel - Channel to inspect.
 * @param {string} botId - Discord bot user ID.
 * @returns {Promise<import('discord.js').Message | null>} Existing message or null.
 * @skill-verified
 */
async function findExistingMembershipFormMessage(channel, botId) {
  const messages = await channel.messages.fetch({ limit: 25 });

  return messages.find((message) => {
    const footerText = message.embeds[0]?.footer?.text;
    return message.author.id === botId && footerText === MEMBERSHIP_FORM_FOOTER;
  }) || null;
}

/**
 * Sends a new membership form message or edits the existing one.
 * @param {import('discord.js').GuildTextBasedChannel} channel - Target channel.
 * @param {string} botId - Discord bot user ID.
 * @returns {Promise<import('discord.js').Message>} Sent or edited message.
 * @skill-verified
 */
async function sendOrEditMembershipForm(channel, botId) {
  const payload = {
    embeds: [buildMembershipFormEmbed()],
    components: [buildMembershipRequestButtonRow()],
    allowedMentions: { parse: [] },
  };
  const existingMessage = await findExistingMembershipFormMessage(channel, botId);

  if (existingMessage) {
    return existingMessage.edit(payload);
  }

  return channel.send(payload);
}

/**
 * Sends the membership form to the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after the form is sent.
 * @skill-verified
 */
async function postMembershipForm(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to post the membership form.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const channel = await findMembershipRequestChannel(guild);

  if (!channel) {
    throw new Error('Не нашел канал заявки в семью/корпу.');
  }

  const message = await sendOrEditMembershipForm(channel, client.user.id);
  console.log(`Форма заявки в семью/корпу обновлена в канале #${channel.name}: ${message.url}`);
}

/**
 * Starts a one-time Discord client and posts the membership form after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts the form after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after the form is posted and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postMembershipForm(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
