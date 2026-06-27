import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} from 'discord.js';
import { getRuntimeConfig } from './config.js';

const TELEGRAM_URL = 'https://t.me/+9eCzsCYQKwo2NWZi';
const TELEGRAM_CHANNEL_ID = '1520419239482101841';
const TELEGRAM_MESSAGE_ID = '1520421190194429953';

/**
 * Builds the Telegram invite embed.
 * @returns {EmbedBuilder} Telegram invite embed.
 * @skill-verified
 */
function buildTelegramEmbed() {
  return new EmbedBuilder()
    .setColor(0x2fbf71)
    .setTitle('💬 Чат в Telegram')
    .setDescription([
      'Подключайся к нашему Telegram-чату, чтобы не пропускать важные сообщения и быстро общаться с составом.',
      '',
      `🔗 ${TELEGRAM_URL}`,
    ].join('\n'))
    .setFooter({ text: 'KILLA FAMQ • Telegram' })
    .setTimestamp();
}

/**
 * Builds the Telegram link button row.
 * @returns {ActionRowBuilder<ButtonBuilder>} Telegram link button row.
 * @skill-verified
 */
function buildTelegramButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Перейти в Telegram')
      .setStyle(ButtonStyle.Link)
      .setURL(TELEGRAM_URL),
  );
}

/**
 * Fetches the configured Telegram text channel.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @returns {Promise<import('discord.js').TextChannel | import('discord.js').NewsChannel>} Telegram channel.
 * @skill-verified
 */
async function fetchTelegramChannel(client) {
  const channel = await client.channels.fetch(TELEGRAM_CHANNEL_ID);

  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
    throw new Error('Не нашел текстовый канал для Telegram-ссылки.');
  }

  return channel;
}

/**
 * Sends or edits the Telegram invite message.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @returns {Promise<void>} Resolves after the Telegram invite is posted.
 * @skill-verified
 */
async function postTelegramInvite(client) {
  const channel = await fetchTelegramChannel(client);
  const payload = {
    embeds: [buildTelegramEmbed()],
    components: [buildTelegramButtonRow()],
    allowedMentions: { parse: [] },
  };

  try {
    const message = await channel.messages.fetch(TELEGRAM_MESSAGE_ID);
    const updatedMessage = await message.edit(payload);
    console.log(`Telegram ссылка обновлена в канале #${channel.name}: ${updatedMessage.url}`);
    return;
  } catch {
    const message = await channel.send(payload);
    console.log(`Telegram ссылка отправлена в канал #${channel.name}: ${message.url}`);
  }
}

/**
 * Starts a one-time Discord client and posts the Telegram invite after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts the Telegram invite after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after posting and destroying the client.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postTelegramInvite(readyClient);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
