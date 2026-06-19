import { ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';
import { setGuildRules } from './store.js';

const RULES = [
  ['Пункт 1.1', 'Запрещен любой вид засорения чата, а также оффтоп в каналах, не предназначенных для свободного общения.'],
  ['Пункт 1.2', 'Запрещено копирование чужих никнеймов, а также использование оскорбительных, провокационных, нечитаемых или вводящих в заблуждение ников.'],
  ['Пункт 1.3', 'Запрещен любой вид рекламы сторонних серверов, проектов, услуг, социальных сетей и прочих ресурсов без разрешения администрации.'],
  ['Пункт 1.4', 'Запрещено навязчиво выпрашивать роли, привилегии, повышение или любые другие преимущества у администрации и модерации.'],
  ['Пункт 1.5', 'Запрещены оскорбления, токсичное поведение, травля, провокации и неуважительное отношение к участникам сервера и администрации.'],
  ['Пункт 1.6', 'Запрещена публикация материалов, содержащих NSFW, шок-контент, сцены насилия, пропаганду наркотиков, терроризма и другой запрещенный контент.'],
  ['Пункт 1.7', 'Запрещен спам сообщениями, стикерами, эмодзи, GIF-изображениями и многократное повторение одинаковых сообщений.'],
  ['Пункт 1.8', 'Запрещено злоупотребление Caps Lock, флуд, бессмысленные сообщения и намеренное создание помех в чатах.'],
  ['Пункт 1.9', 'Запрещено выдавать себя за администрацию, модерацию или других участников сервера.'],
  ['Пункт 1.10', 'Личные конфликты запрещено выносить в общий чат. Все спорные ситуации решаются через администрацию.'],
  ['Пункт 1.11', 'В голосовых каналах запрещено мешать другим участникам: кричать, включать громкие звуки, музыку без согласия и создавать дискомфорт.'],
  ['Пункт 1.12', 'Запрещено распространять вредоносные ссылки, подозрительные файлы, читы, а также любой контент, способный навредить серверу или его участникам.'],
  ['Пункт 1.13', 'Незнание правил не освобождает от ответственности.'],
  ['Пункт 1.14', 'Администрация вправе выдать предупреждение, мут, кик или бан в зависимости от тяжести нарушения.'],
];

const NOTE = 'Администрация оставляет за собой право принимать решения в спорных ситуациях для поддержания порядка и комфорта на сервере.';

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
 * Checks whether a channel name looks like the rules channel.
 * @param {{ name: string }} channel - Discord channel.
 * @returns {boolean} True when the channel looks like the rules channel.
 * @skill-verified
 */
function isRulesChannel(channel) {
  const name = normalizeChannelName(channel.name);
  return name.includes('правила') || name.includes('rules');
}

/**
 * Checks whether a category name looks like an information category.
 * @param {{ name: string }} channel - Discord category channel.
 * @returns {boolean} True when the category looks like the information category.
 * @skill-verified
 */
function isInfoCategory(channel) {
  const name = normalizeChannelName(channel.name);
  return name.includes('информация') || name.includes('information') || name.includes('info');
}

/**
 * Finds the rules text channel, preferring a channel inside the information category.
 * @param {import('discord.js').Collection<string, import('discord.js').GuildBasedChannel | null>} channels - Guild channels.
 * @returns {import('discord.js').TextChannel | import('discord.js').NewsChannel | null} Matching rules channel.
 * @skill-verified
 */
function findRulesChannel(channels) {
  const channelList = [...channels.values()].filter(Boolean);

  /**
   * Checks whether a channel is a category that looks like information.
   * @param {import('discord.js').GuildBasedChannel} channel - Guild channel.
   * @returns {boolean} True when the channel is the information category.
   * @skill-verified
   */
  function isMatchingInfoCategory(channel) {
    return channel.type === ChannelType.GuildCategory && isInfoCategory(channel);
  }

  /**
   * Checks whether a channel can receive text messages.
   * @param {import('discord.js').GuildBasedChannel} channel - Guild channel.
   * @returns {boolean} True when the channel is a text channel.
   * @skill-verified
   */
  function isTextChannel(channel) {
    return channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
  }

  const infoCategory = channelList.find(isMatchingInfoCategory);
  const textChannels = channelList.filter(isTextChannel);

  /**
   * Checks whether a text channel is the preferred rules channel.
   * @param {import('discord.js').GuildBasedChannel} channel - Guild channel.
   * @returns {boolean} True when the channel is a rules channel in the information category.
   * @skill-verified
   */
  function isPreferredRulesChannel(channel) {
    return isRulesChannel(channel) && (!infoCategory || channel.parentId === infoCategory.id);
  }

  return textChannels.find(isPreferredRulesChannel)
    || textChannels.find(isRulesChannel)
    || null;
}

/**
 * Builds the decorative rules embed sent to the server.
 * @returns {EmbedBuilder} Decorative rules embed.
 * @skill-verified
 */
function buildRulesEmbed() {
  const lines = ['Пожалуйста, ознакомьтесь с правилами. Их соблюдение помогает поддерживать порядок и комфорт на сервере.', ''];

  for (const [title, text] of RULES) {
    lines.push(`**${title}**`, text, '');
  }

  lines.push('**⚠️ Примечание**', NOTE);

  const embed = new EmbedBuilder()
    .setColor(0xd7263d)
    .setTitle('📜 Правила сервера')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'KILLA FAMQ • Модерация сервера' })
    .setTimestamp();

  return embed;
}

/**
 * Converts structured rules into the plain rules saved for /правила.
 * @returns {string[]} Plain rules.
 * @skill-verified
 */
function getPlainRules() {
  const plainRules = [];

  for (const [title, text] of RULES) {
    plainRules.push(`${title}. ${text}`);
  }

  plainRules.push(`Примечание. ${NOTE}`);
  return plainRules;
}

/**
 * Sends rules to the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after rules are sent.
 * @skill-verified
 */
async function postRules(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to post rules.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const channel = findRulesChannel(channels);

  if (!channel) {
    throw new Error('Не нашел канал правил на сервере.');
  }

  await setGuildRules(config.guildId, getPlainRules());
  const message = await channel.send({ embeds: [buildRulesEmbed()], allowedMentions: { parse: [] } });
  console.log(`Правила отправлены в канал #${channel.name}: ${message.url}`);
}

/**
 * Starts a one-time Discord client and posts rules after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts rules after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after rules are posted and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postRules(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
