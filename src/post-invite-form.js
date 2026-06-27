import { ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';
import { buildInviteRequestButtonRow } from './form-components.js';

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
 * Checks whether a channel name looks like an invite channel.
 * @param {import('discord.js').GuildBasedChannel} channel - Guild channel.
 * @returns {boolean} True when the channel looks like the invite channel.
 * @skill-verified
 */
function isInviteChannel(channel) {
  const name = normalizeChannelName(channel.name);
  return name.includes('инвайт') || name.includes('приглаш') || name.includes('invite');
}

/**
 * Finds the invite channel on the guild.
 * @param {import('discord.js').Collection<string, import('discord.js').GuildBasedChannel | null>} channels - Guild channels.
 * @returns {import('discord.js').TextChannel | import('discord.js').NewsChannel | null} Matching channel.
 * @skill-verified
 */
function findInviteChannel(channels) {
  const channelList = [...channels.values()].filter(Boolean);
  const textChannels = channelList.filter(isTextChannel);
  return textChannels.find(isInviteChannel) || null;
}

/**
 * Builds the invite request form embed.
 * @returns {EmbedBuilder} Invite request form embed.
 * @skill-verified
 */
function buildInviteFormEmbed() {
  return new EmbedBuilder()
    .setColor(0x2fbf71)
    .setTitle('🗒️ Заявка на инвайт')
    .setDescription([
      'Чтобы оформить инвайт, нажми кнопку ниже и заполни форму.',
      '',
      '**Ваш ник | CID**',
      '**Ник | CID приглашённого**',
    ].join('\n'))
    .setFooter({ text: 'KILLA FAMQ • Инвайты' })
    .setTimestamp();
}

/**
 * Sends the invite form to the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after the form is sent.
 * @skill-verified
 */
async function postInviteForm(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to post the invite form.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const channel = findInviteChannel(channels);

  if (!channel) {
    throw new Error('Не нашел канал инвайтов.');
  }

  const message = await channel.send({
    embeds: [buildInviteFormEmbed()],
    components: [buildInviteRequestButtonRow()],
    allowedMentions: { parse: [] },
  });
  console.log(`Форма инвайтов отправлена в канал #${channel.name}: ${message.url}`);
}

/**
 * Starts a one-time Discord client and posts the invite form after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts the invite form after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after the form is posted and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postInviteForm(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
