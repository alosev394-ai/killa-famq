import { ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';
import { buildRoleRequestButtonRow } from './form-components.js';

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
 * Checks whether a channel name looks like a role-request channel.
 * @param {import('discord.js').GuildBasedChannel} channel - Guild channel.
 * @returns {boolean} True when the channel looks like the role request channel.
 * @skill-verified
 */
function isRoleRequestChannel(channel) {
  const name = normalizeChannelName(channel.name);
  return name.includes('подача') && (name.includes('роли') || name.includes('роль'));
}

/**
 * Finds the role request channel on the guild.
 * @param {import('discord.js').Collection<string, import('discord.js').GuildBasedChannel | null>} channels - Guild channels.
 * @returns {import('discord.js').TextChannel | import('discord.js').NewsChannel | null} Matching channel.
 * @skill-verified
 */
function findRoleRequestChannel(channels) {
  const channelList = [...channels.values()].filter(Boolean);
  const textChannels = channelList.filter(isTextChannel);
  return textChannels.find(isRoleRequestChannel) || null;
}

/**
 * Builds the role request form embed.
 * @returns {EmbedBuilder} Role request form embed.
 * @skill-verified
 */
function buildRoleFormEmbed() {
  return new EmbedBuilder()
    .setColor(0x111111)
    .setTitle('🎴 Подача на получение роли')
    .setDescription([
      'Чтобы получить роль на сервере, отправь заявку строго по форме:',
      '',
      '**Игровой ник:**',
      '**Статик / ID:**',
      '**Скрин F2 - Персонаж:**',
      '',
      'Заявки не по форме могут быть отклонены администрацией.',
    ].join('\n'))
    .setFooter({ text: 'KILLA FAMQ • Заявки на роли' })
    .setTimestamp();
}

/**
 * Sends the role request form to the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after the form is sent.
 * @skill-verified
 */
async function postRoleForm(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to post the role form.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const channel = findRoleRequestChannel(channels);

  if (!channel) {
    throw new Error('Не нашел канал подачи на получение роли.');
  }

  const message = await channel.send({ embeds: [buildRoleFormEmbed()], components: [buildRoleRequestButtonRow()], allowedMentions: { parse: [] } });
  console.log(`Форма отправлена в канал #${channel.name}: ${message.url}`);
}

/**
 * Starts a one-time Discord client and posts the role request form after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts the role form after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after the form is posted and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postRoleForm(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
