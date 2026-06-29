import {
  ActivityType,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { COMMAND_GROUPS } from './commands.js';
import { getRuntimeConfig } from './config.js';
import {
  FORM_IDS,
  buildInviteRequestModal,
  buildMembershipRequestModal,
  buildMembershipTicketCloseButtonRow,
  buildPromotionReportModal,
  buildSalesLotModal,
  buildSalesLotStatusButtonRow,
} from './form-components.js';
import { buildLogIntents, buildLogPartials, registerLogHandlers, sendStartupLogs } from './logging.js';
import {
  addGuildPriceItem,
  buildPriceListEmbed,
  getGuildPriceList,
  publishGuildPriceList,
  removeGuildPriceItem,
  updateGuildPriceItem,
} from './price-list.js';
import {
  addGuildRule,
  addWarning,
  clearGuildRules,
  clearWarnings,
  getGuildRules,
  getWarnings,
  setGuildRules,
} from './store.js';

const BRAND = {
  name: 'KILLA FAMQ',
  color: 0xd7263d,
  ok: 0x2fbf71,
  warn: 0xf2c14e,
  danger: 0xd7263d,
  quiet: 0x22223b,
};

const POLL_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

/**
 * Creates a branded embed used by the bot.
 * @param {string} title - Embed title.
 * @param {string} description - Embed description.
 * @param {number} [color=BRAND.color] - Embed color.
 * @returns {EmbedBuilder} A configured embed.
 * @skill-verified
 */
function createEmbed(title, description, color = BRAND.color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: BRAND.name });
}

/**
 * Sends an ephemeral response to an interaction.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @param {string | { embeds: EmbedBuilder[] }} payload - Response text or embed payload.
 * @returns {Promise<void>} Resolves after the response is sent.
 * @skill-verified
 */
async function replyPrivate(interaction, payload) {
  const response = typeof payload === 'string' ? { content: payload } : payload;
  const options = { ...response, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(options);
    return;
  }

  await interaction.reply(options);
}

/**
 * Sends a public response to an interaction.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @param {string | { embeds: EmbedBuilder[] }} payload - Response text or embed payload.
 * @returns {Promise<void>} Resolves after the response is sent.
 * @skill-verified
 */
async function replyPublic(interaction, payload) {
  const response = typeof payload === 'string' ? { content: payload } : payload;
  await interaction.reply({ ...response, allowedMentions: { parse: [] } });
}

/**
 * Ensures the command is used inside a Discord server.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<boolean>} True when the interaction is in a guild.
 * @skill-verified
 */
async function ensureGuildInteraction(interaction) {
  if (interaction.inGuild()) {
    return true;
  }

  await replyPrivate(interaction, 'Эта команда работает только на сервере.');
  return false;
}

/**
 * Checks whether the bot has a required guild permission.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @param {bigint} permission - Required Discord permission.
 * @param {string} label - Human readable permission name.
 * @returns {Promise<boolean>} True when the bot has the permission.
 * @skill-verified
 */
async function ensureBotPermission(interaction, permission, label) {
  const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe());

  if (me.permissions.has(permission)) {
    return true;
  }

  await replyPrivate(interaction, `Мне не хватает права: ${label}. Выдай его роли бота и повтори команду.`);
  return false;
}

/**
 * Returns a required guild member option or replies with an error.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @param {string} optionName - User option name.
 * @returns {Promise<import('discord.js').GuildMember | null>} Guild member or null when unavailable.
 * @skill-verified
 */
async function getRequiredMember(interaction, optionName) {
  const member = interaction.options.getMember(optionName);

  if (member) {
    return member;
  }

  await replyPrivate(interaction, 'Не нашел этого пользователя на сервере.');
  return null;
}

/**
 * Builds a safe audit-log reason.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @param {string | null} reason - User supplied reason.
 * @returns {string} Truncated audit-log reason.
 * @skill-verified
 */
function buildAuditReason(interaction, reason) {
  const baseReason = reason?.trim() || 'Без причины';
  const fullReason = `${baseReason} | Модератор: ${interaction.user.tag} (${interaction.user.id})`;
  return fullReason.length > 512 ? fullReason.slice(0, 509) + '...' : fullReason;
}

/**
 * Splits a multiline rules text into clean rule items.
 * @param {string} text - Rules text.
 * @returns {string[]} Clean rule list.
 * @skill-verified
 */
function parseRules(text) {
  const lines = text.split(/\r?\n/);
  const rules = [];

  for (const line of lines) {
    const cleanLine = line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim();

    if (cleanLine) {
      rules.push(cleanLine);
    }
  }

  return rules;
}

/**
 * Formats saved rules as a numbered Discord message.
 * @param {string[]} rules - Rule list.
 * @returns {string} Formatted rules text.
 * @skill-verified
 */
function formatRules(rules) {
  if (rules.length === 0) {
    return 'Правила еще не настроены. Админ может добавить их через `/правила-настроить`.';
  }

  const lines = [];

  for (let index = 0; index < rules.length; index += 1) {
    lines.push(`**${index + 1}.** ${rules[index]}`);
  }

  return lines.join('\n');
}

/**
 * Parses poll options from semicolon-separated user input.
 * @param {string} text - Raw options text.
 * @returns {string[]} Poll options.
 * @skill-verified
 */
function parsePollOptions(text) {
  const parts = text.split(';');
  const options = [];

  for (const part of parts) {
    const option = part.trim();

    if (option) {
      options.push(option);
    }
  }

  return options;
}

/**
 * Formats poll options with reaction emojis.
 * @param {string[]} options - Poll options.
 * @returns {string} Formatted poll option list.
 * @skill-verified
 */
function formatPollOptions(options) {
  const lines = [];

  for (let index = 0; index < options.length; index += 1) {
    lines.push(`${POLL_EMOJIS[index]} ${options[index]}`);
  }

  return lines.join('\n');
}

/**
 * Formats saved warnings for display.
 * @param {Array<Record<string, string>>} warnings - Warning records.
 * @returns {string} Formatted warning list.
 * @skill-verified
 */
function formatWarnings(warnings) {
  if (warnings.length === 0) {
    return 'Предупреждений нет.';
  }

  const lines = [];

  for (let index = 0; index < warnings.length; index += 1) {
    const warning = warnings[index];
    lines.push(`**${index + 1}.** ${warning.reason}\nМодератор: <@${warning.moderatorId}> • ${warning.createdAt}`);
  }

  return lines.join('\n\n');
}

/**
 * Returns a text channel from an optional channel option or the current interaction channel.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @param {string} optionName - Channel option name.
 * @returns {import('discord.js').GuildTextBasedChannel | null} Target text channel.
 * @skill-verified
 */
function getTargetTextChannel(interaction, optionName) {
  const selectedChannel = interaction.options.getChannel(optionName);
  const channel = selectedChannel || interaction.channel;

  if (!channel || !channel.isTextBased() || channel.type === ChannelType.DM) {
    return null;
  }

  return channel;
}

/**
 * Returns a trimmed modal text field value.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Modal submit interaction.
 * @param {string} fieldId - Text field custom ID.
 * @returns {string} Trimmed field value.
 * @skill-verified
 */
function getModalTextValue(interaction, fieldId) {
  return interaction.fields.getTextInputValue(fieldId).trim();
}

/**
 * Formats an optional field value for an embed.
 * @param {string} value - Raw field value.
 * @returns {string} Formatted embed field value.
 * @skill-verified
 */
function formatOptionalField(value) {
  const cleanValue = value.trim();
  return cleanValue || 'Не указано';
}

/**
 * Truncates text to fit safely inside an embed field.
 * @param {string} value - Raw field value.
 * @param {number} maxLength - Maximum allowed length.
 * @returns {string} Truncated field value.
 * @skill-verified
 */
function truncateFieldValue(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

/**
 * Returns a normalized HTTP(S) URL or null.
 * @param {string} value - Raw URL value.
 * @returns {string | null} Normalized URL when valid.
 * @skill-verified
 */
function getHttpUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

/**
 * Checks whether a URL is likely to be renderable as an embed image.
 * @param {string} url - Normalized URL.
 * @returns {boolean} True when the URL looks image-like.
 * @skill-verified
 */
function isLikelyImageUrl(url) {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.startsWith('https://cdn.discordapp.com/')
    || lowerUrl.startsWith('https://media.discordapp.net/')
    || /\.(?:png|jpe?g|gif|webp)(?:$|[?#])/i.test(lowerUrl);
}

/**
 * Adds screenshot information to an embed.
 * @param {EmbedBuilder} embed - Embed to update.
 * @param {string} screenshot - Screenshot text or URL.
 * @returns {EmbedBuilder} Updated embed.
 * @skill-verified
 */
function addScreenshotToEmbed(embed, screenshot) {
  const screenshotUrl = getHttpUrl(screenshot);

  if (!screenshotUrl) {
    embed.addFields({ name: 'Скрин', value: truncateFieldValue(screenshot, 1024) });
    return embed;
  }

  embed.addFields({ name: 'Скрин', value: `[Открыть скрин](${screenshotUrl})` });

  if (isLikelyImageUrl(screenshotUrl)) {
    embed.setImage(screenshotUrl);
  }

  return embed;
}

/**
 * Builds an embed for a submitted sales lot.
 * @param {import('discord.js').User} user - User who submitted the form.
 * @param {{ item: string, price: string, description: string, screenshot: string }} data - Submitted sales data.
 * @returns {EmbedBuilder} Sales lot submission embed.
 * @skill-verified
 */
function buildSalesSubmissionEmbed(user, data) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.ok)
    .setTitle('💸 Лот на продажу')
    .setDescription(`<@${user.id}>`)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ size: 128 }) })
    .addFields(
      { name: 'Товар', value: truncateFieldValue(data.item, 1024), inline: true },
      { name: 'Цена', value: truncateFieldValue(data.price, 1024), inline: true },
      { name: 'Описание', value: truncateFieldValue(formatOptionalField(data.description), 1024) },
      { name: 'Статус', value: '✅ Актуально', inline: true },
    )
    .setFooter({ text: 'KILLA FAMQ • Лот' })
    .setTimestamp();

  return addScreenshotToEmbed(embed, data.screenshot);
}

/**
 * Builds an embed for a submitted invite request.
 * @param {import('discord.js').User} user - User who submitted the form.
 * @param {{ requester: string, guest: string }} data - Submitted invite request data.
 * @returns {EmbedBuilder} Invite request submission embed.
 * @skill-verified
 */
function buildInviteSubmissionEmbed(user, data) {
  return new EmbedBuilder()
    .setColor(BRAND.ok)
    .setTitle('🗒️ Заявка на инвайт')
    .setDescription(`<@${user.id}>`)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ size: 128 }) })
    .addFields(
      { name: 'Ваш ник | CID', value: truncateFieldValue(data.requester, 1024) },
      { name: 'Ник | CID приглашённого', value: truncateFieldValue(data.guest, 1024) },
    )
    .setFooter({ text: 'KILLA FAMQ • Инвайты' })
    .setTimestamp();
}

/**
 * Builds an embed for a submitted promotion report.
 * @param {import('discord.js').User} user - User who submitted the form.
 * @param {{ nickname: string, cid: string, currentRank: string, targetRank: string, wood: string }} data - Submitted promotion report data.
 * @returns {EmbedBuilder} Promotion report submission embed.
 * @skill-verified
 */
function buildPromotionSubmissionEmbed(user, data) {
  return new EmbedBuilder()
    .setColor(BRAND.ok)
    .setTitle('📈 Отчёт на повышение')
    .setDescription(`<@${user.id}>`)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ size: 128 }) })
    .addFields(
      { name: 'Игровой ник', value: truncateFieldValue(data.nickname, 1024), inline: true },
      { name: 'CID', value: truncateFieldValue(data.cid, 1024), inline: true },
      { name: 'Текущий ранг', value: truncateFieldValue(data.currentRank, 1024), inline: true },
      { name: 'Хочет на ранг', value: truncateFieldValue(data.targetRank, 1024), inline: true },
      { name: 'Сколько дерева собрал', value: truncateFieldValue(data.wood, 1024) },
    )
    .setFooter({ text: 'KILLA FAMQ • Повышение' })
    .setTimestamp();
}

/**
 * Builds an embed for a submitted membership request.
 * @param {import('discord.js').User} user - User who submitted the form.
 * @param {{ type: 'family' | 'corp', nickname: string, cid: string, rank: string }} data - Submitted membership request data.
 * @returns {EmbedBuilder} Membership request embed.
 * @skill-verified
 */
function buildMembershipSubmissionEmbed(user, data) {
  const typeLabel = formatMembershipType(data.type);

  return new EmbedBuilder()
    .setColor(data.type === 'family' ? BRAND.quiet : BRAND.ok)
    .setTitle(data.type === 'family' ? '🟣 Заявка в семью' : '🏢 Заявка в корпу')
    .setDescription(`<@${user.id}>`)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ size: 128 }) })
    .addFields(
      { name: 'Игровой ник', value: truncateFieldValue(data.nickname, 1024), inline: true },
      { name: 'CID', value: truncateFieldValue(data.cid, 1024), inline: true },
      { name: 'Куда', value: typeLabel, inline: true },
      { name: 'Ранг', value: truncateFieldValue(data.rank, 1024), inline: true },
    )
    .setFooter({ text: `KILLA FAMQ • ${typeLabel}` })
    .setTimestamp();
}

/**
 * Sends a submitted form embed to the current channel.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Modal submit interaction.
 * @param {EmbedBuilder} embed - Submission embed.
 * @param {Array<import('discord.js').ActionRowBuilder>} [components=[]] - Optional message components.
 * @returns {Promise<void>} Resolves after the submission is sent.
 * @skill-verified
 */
async function sendSubmissionEmbed(interaction, embed, components = []) {
  if (!interaction.channel || !interaction.channel.isTextBased() || !('send' in interaction.channel)) {
    await interaction.reply({ content: 'Не нашел канал, куда отправить результат формы.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.channel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [embed],
    components,
    allowedMentions: { users: [interaction.user.id] },
  });
  await interaction.editReply('Готово, отправил.');
}

/**
 * Returns a sales lot status from a status button custom ID.
 * @param {string} customId - Button custom ID.
 * @returns {'active' | 'inactive' | null} Sales lot status or null.
 * @skill-verified
 */
function getSalesStatusFromCustomId(customId) {
  if (customId === FORM_IDS.salesStatusActive) {
    return 'active';
  }

  if (customId === FORM_IDS.salesStatusInactive) {
    return 'inactive';
  }

  return null;
}

/**
 * Handles sales lot status buttons.
 * @param {import('discord.js').ButtonInteraction} interaction - Button interaction.
 * @returns {Promise<boolean>} True when the button was handled.
 * @skill-verified
 */
async function handleSalesStatusButton(interaction) {
  const status = getSalesStatusFromCustomId(interaction.customId);

  if (!status) {
    return false;
  }

  const ownerId = extractSalesLotOwnerId(interaction.message);

  if (!canUpdateSalesLot(interaction, ownerId)) {
    await interaction.reply({ content: 'Статус этого лота может менять только автор лота или администрация.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const originalEmbed = interaction.message.embeds[0];

  if (!originalEmbed) {
    await interaction.reply({ content: 'Не нашел embed лота для обновления.', flags: MessageFlags.Ephemeral });
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.message.edit({
    embeds: [buildSalesStatusEmbed(originalEmbed, status, interaction.user)],
    components: [buildSalesLotStatusButtonRow(status)],
    allowedMentions: { parse: [] },
  });
  await interaction.editReply(`Статус лота обновлен: ${formatSalesStatus(status)}.`);
  return true;
}

/**
 * Extracts the sales lot owner ID from a bot lot message.
 * @param {import('discord.js').Message} message - Sales lot message.
 * @returns {string | null} Owner user ID or null.
 * @skill-verified
 */
function extractSalesLotOwnerId(message) {
  return extractMentionId(message.content) || extractMentionId(message.embeds[0]?.description || '');
}

/**
 * Extracts the first Discord user mention ID from text.
 * @param {string} value - Text to inspect.
 * @returns {string | null} Discord user ID or null.
 * @skill-verified
 */
function extractMentionId(value) {
  const match = value.match(/<@!?(\d+)>/);
  return match ? match[1] : null;
}

/**
 * Checks whether a user can change the sales lot status.
 * @param {import('discord.js').ButtonInteraction} interaction - Button interaction.
 * @param {string | null} ownerId - Sales lot owner ID.
 * @returns {boolean} True when the user may update the lot status.
 * @skill-verified
 */
function canUpdateSalesLot(interaction, ownerId) {
  if (ownerId && interaction.user.id === ownerId) {
    return true;
  }

  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages));
}

/**
 * Builds an updated sales lot embed with the selected status.
 * @param {import('discord.js').Embed} originalEmbed - Existing sales lot embed.
 * @param {'active' | 'inactive'} status - New sales lot status.
 * @param {import('discord.js').User} actor - User who changed the status.
 * @returns {EmbedBuilder} Updated sales lot embed.
 * @skill-verified
 */
function buildSalesStatusEmbed(originalEmbed, status, actor) {
  const embed = EmbedBuilder.from(originalEmbed)
    .setColor(status === 'active' ? BRAND.ok : BRAND.quiet)
    .setTitle(status === 'active' ? '💸 Лот на продажу' : '💸 Лот неактуален')
    .setTimestamp();
  const fields = originalEmbed.fields.filter((field) => field.name !== 'Статус' && field.name !== 'Статус обновил');

  fields.push(
    { name: 'Статус', value: formatSalesStatus(status), inline: true },
    { name: 'Статус обновил', value: `<@${actor.id}>`, inline: true },
  );
  embed.setFields(fields);

  return embed;
}

/**
 * Formats a sales lot status label.
 * @param {'active' | 'inactive'} status - Sales lot status.
 * @returns {string} Human-readable status label.
 * @skill-verified
 */
function formatSalesStatus(status) {
  return status === 'active' ? '✅ Актуально' : '❌ Неактуально';
}

/**
 * Formats a membership request type.
 * @param {'family' | 'corp'} type - Membership request type.
 * @returns {string} Human-readable request type.
 * @skill-verified
 */
function formatMembershipType(type) {
  return type === 'family' ? 'Семья' : 'Корпа';
}

/**
 * Returns a membership type from a request button custom ID.
 * @param {string} customId - Button custom ID.
 * @returns {'family' | 'corp' | null} Membership type or null.
 * @skill-verified
 */
function getMembershipTypeFromButtonId(customId) {
  if (customId === FORM_IDS.membershipFamilyButton) {
    return 'family';
  }

  if (customId === FORM_IDS.membershipCorpButton) {
    return 'corp';
  }

  return null;
}

/**
 * Returns a membership type from a modal custom ID.
 * @param {string} customId - Modal custom ID.
 * @returns {'family' | 'corp' | null} Membership type or null.
 * @skill-verified
 */
function getMembershipTypeFromModalId(customId) {
  if (customId === FORM_IDS.membershipFamilyModal) {
    return 'family';
  }

  if (customId === FORM_IDS.membershipCorpModal) {
    return 'corp';
  }

  return null;
}

/**
 * Normalizes Discord object names for fuzzy matching.
 * @param {string} value - Raw name.
 * @returns {string} Normalized name.
 * @skill-verified
 */
function normalizeDiscordName(value) {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/ё/g, 'е')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

/**
 * Checks whether a role looks like a leader or deputy leader role.
 * @param {import('discord.js').Role} role - Discord role.
 * @returns {boolean} True when the role should see membership tickets.
 * @skill-verified
 */
function isLeadershipRole(role) {
  const name = normalizeDiscordName(role.name);
  return name.includes('leader')
    || name.includes('lider')
    || name.includes('лидер')
    || name.includes('deplider')
    || name.includes('depleader')
    || name.includes('деплидер');
}

/**
 * Finds leader and deputy leader roles in a guild.
 * @param {import('discord.js').Guild} guild - Guild to inspect.
 * @returns {Promise<import('discord.js').Role[]>} Matching leadership roles.
 * @skill-verified
 */
async function findLeadershipRoles(guild) {
  const roles = await guild.roles.fetch();
  return [...roles.values()].filter((role) => !role.managed && isLeadershipRole(role));
}

/**
 * Builds a safe text-channel name part.
 * @param {string} value - Raw user supplied name.
 * @returns {string} Safe channel name part.
 * @skill-verified
 */
function buildSafeChannelNamePart(value) {
  const cleanValue = value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/ё/g, 'е')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);

  return cleanValue || 'игрок';
}

/**
 * Builds a membership ticket channel name.
 * @param {'family' | 'corp'} type - Membership request type.
 * @param {string} nickname - Submitted game nickname.
 * @returns {string} Ticket channel name.
 * @skill-verified
 */
function buildMembershipTicketChannelName(type, nickname) {
  const typePart = type === 'family' ? 'семья' : 'корпа';
  return `заявка-${typePart}-${buildSafeChannelNamePart(nickname)}`.slice(0, 100);
}

/**
 * Builds an archived membership ticket channel name.
 * @param {string} channelName - Current channel name.
 * @returns {string} Archived channel name.
 * @skill-verified
 */
function buildArchivedTicketChannelName(channelName) {
  if (normalizeDiscordName(channelName).startsWith('архив')) {
    return channelName;
  }

  return `архив-${channelName}`.slice(0, 100);
}

/**
 * Checks whether a category is the archive category.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Channel to inspect.
 * @returns {boolean} True when the channel is an archive category.
 * @skill-verified
 */
function isArchiveCategory(channel) {
  if (!channel || channel.type !== ChannelType.GuildCategory) {
    return false;
  }

  const name = normalizeDiscordName(channel.name);
  return name.includes('архив') || name.includes('archive');
}

/**
 * Finds the archive category in a guild.
 * @param {import('discord.js').Guild} guild - Guild to search.
 * @returns {Promise<import('discord.js').CategoryChannel | null>} Archive category or null.
 * @skill-verified
 */
async function findArchiveCategory(guild) {
  await guild.channels.fetch();

  for (const [, channel] of guild.channels.cache) {
    if (isArchiveCategory(channel)) {
      return channel;
    }
  }

  return null;
}

/**
 * Returns the open ticket parent category ID.
 * @param {import('discord.js').GuildTextBasedChannel | null} sourceChannel - Channel where the form was submitted.
 * @returns {string | null} Parent category ID or null.
 * @skill-verified
 */
function getOpenTicketParentId(sourceChannel) {
  if (!sourceChannel || !('parent' in sourceChannel) || !sourceChannel.parent || isArchiveCategory(sourceChannel.parent)) {
    return null;
  }

  return sourceChannel.parent.id;
}

/**
 * Builds permission overwrites for an open membership ticket.
 * @param {import('discord.js').Guild} guild - Guild that owns the ticket.
 * @param {string} applicantId - Discord user ID of the applicant.
 * @param {import('discord.js').Role[]} leadershipRoles - Roles that should see the ticket.
 * @returns {Promise<Array<Record<string, unknown>>>} Permission overwrite payloads.
 * @skill-verified
 */
async function buildMembershipTicketOverwrites(guild, applicantId, leadershipRoles) {
  return buildMembershipAccessOverwrites(guild, leadershipRoles, applicantId);
}

/**
 * Builds permission overwrites for an archived membership ticket.
 * @param {import('discord.js').Guild} guild - Guild that owns the ticket.
 * @param {import('discord.js').Role[]} leadershipRoles - Roles that should see the archived ticket.
 * @returns {Promise<Array<Record<string, unknown>>>} Permission overwrite payloads.
 * @skill-verified
 */
async function buildArchivedMembershipTicketOverwrites(guild, leadershipRoles) {
  return buildMembershipAccessOverwrites(guild, leadershipRoles, null);
}

/**
 * Builds permission overwrites for ticket visibility.
 * @param {import('discord.js').Guild} guild - Guild that owns the ticket.
 * @param {import('discord.js').Role[]} leadershipRoles - Roles that should see the ticket.
 * @param {string | null} applicantId - Discord user ID of the applicant, if the applicant should still see the ticket.
 * @returns {Promise<Array<Record<string, unknown>>>} Permission overwrite payloads.
 * @skill-verified
 */
async function buildMembershipAccessOverwrites(guild, leadershipRoles, applicantId) {
  const overwrites = new Map();
  const me = guild.members.me || await guild.members.fetchMe();
  const viewPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
  ];

  overwrites.set(guild.roles.everyone.id, { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
  overwrites.set(me.id, { id: me.id, allow: [...viewPermissions, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] });
  overwrites.set(guild.ownerId, { id: guild.ownerId, allow: viewPermissions });

  if (applicantId) {
    overwrites.set(applicantId, { id: applicantId, allow: viewPermissions });
  }

  for (const role of leadershipRoles) {
    overwrites.set(role.id, { id: role.id, allow: viewPermissions });
  }

  return [...overwrites.values()];
}

/**
 * Builds the ticket message content with mentions.
 * @param {import('discord.js').User} applicant - Applicant user.
 * @param {import('discord.js').Guild} guild - Guild that owns the ticket.
 * @param {import('discord.js').Role[]} leadershipRoles - Roles to mention.
 * @returns {string} Ticket message content.
 * @skill-verified
 */
function buildMembershipTicketContent(applicant, guild, leadershipRoles) {
  const roleMentions = leadershipRoles.map((role) => `<@&${role.id}>`).join(' ');
  return [`<@${applicant.id}>`, `<@${guild.ownerId}>`, roleMentions].filter(Boolean).join(' ');
}

/**
 * Builds allowed mentions for a ticket message.
 * @param {import('discord.js').User} applicant - Applicant user.
 * @param {import('discord.js').Guild} guild - Guild that owns the ticket.
 * @param {import('discord.js').Role[]} leadershipRoles - Roles to allow mentioning.
 * @returns {{ users: string[], roles: string[] }} Allowed mention IDs.
 * @skill-verified
 */
function buildMembershipTicketAllowedMentions(applicant, guild, leadershipRoles) {
  return {
    users: [applicant.id, guild.ownerId],
    roles: leadershipRoles.map((role) => role.id),
  };
}

/**
 * Creates a private membership ticket channel.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Modal submit interaction.
 * @param {{ type: 'family' | 'corp', nickname: string, cid: string, rank: string }} data - Membership request data.
 * @returns {Promise<import('discord.js').TextChannel>} Created ticket channel.
 * @skill-verified
 */
async function createMembershipTicket(interaction, data) {
  const guild = interaction.guild;
  const leadershipRoles = await findLeadershipRoles(guild);
  const parentId = getOpenTicketParentId(interaction.channel);
  const createOptions = {
    name: buildMembershipTicketChannelName(data.type, data.nickname),
    type: ChannelType.GuildText,
    permissionOverwrites: await buildMembershipTicketOverwrites(guild, interaction.user.id, leadershipRoles),
    reason: `Заявка ${formatMembershipType(data.type)} от ${interaction.user.tag}`,
  };

  if (parentId) {
    createOptions.parent = parentId;
  }

  const ticketChannel = await guild.channels.create(createOptions);

  await ticketChannel.send({
    content: buildMembershipTicketContent(interaction.user, guild, leadershipRoles),
    embeds: [buildMembershipSubmissionEmbed(interaction.user, data)],
    components: [buildMembershipTicketCloseButtonRow()],
    allowedMentions: buildMembershipTicketAllowedMentions(interaction.user, guild, leadershipRoles),
  });

  return ticketChannel;
}

/**
 * Checks whether a member has any of the provided roles.
 * @param {import('discord.js').GuildMember | import('discord.js').APIInteractionGuildMember | null} member - Member to inspect.
 * @param {string[]} roleIds - Role IDs to check.
 * @returns {boolean} True when the member has at least one role.
 * @skill-verified
 */
function memberHasAnyRole(member, roleIds) {
  if (!member || roleIds.length === 0 || !('roles' in member)) {
    return false;
  }

  if (Array.isArray(member.roles)) {
    return roleIds.some((roleId) => member.roles.includes(roleId));
  }

  return roleIds.some((roleId) => member.roles.cache.has(roleId));
}

/**
 * Checks whether a user may close a membership ticket.
 * @param {import('discord.js').ButtonInteraction} interaction - Button interaction.
 * @param {import('discord.js').Role[]} leadershipRoles - Roles allowed to close tickets.
 * @returns {boolean} True when the user may close the ticket.
 * @skill-verified
 */
function canCloseMembershipTicket(interaction, leadershipRoles) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    return true;
  }

  return memberHasAnyRole(interaction.member, leadershipRoles.map((role) => role.id));
}

/**
 * Archives a membership ticket channel.
 * @param {import('discord.js').TextChannel} channel - Ticket channel to archive.
 * @param {import('discord.js').CategoryChannel} archiveCategory - Archive category.
 * @param {import('discord.js').Role[]} leadershipRoles - Roles that should keep access.
 * @param {import('discord.js').User} actor - User who closed the ticket.
 * @returns {Promise<void>} Resolves after the ticket is archived.
 * @skill-verified
 */
async function archiveMembershipTicket(channel, archiveCategory, leadershipRoles, actor) {
  const reason = `Заявку закрыл ${actor.tag}`;

  await channel.setParent(archiveCategory.id, { lockPermissions: false, reason });
  await channel.permissionOverwrites.set(await buildArchivedMembershipTicketOverwrites(channel.guild, leadershipRoles), reason);

  const archivedName = buildArchivedTicketChannelName(channel.name);

  if (archivedName !== channel.name) {
    await channel.setName(archivedName, reason);
  }
}

/**
 * Handles membership ticket close buttons.
 * @param {import('discord.js').ButtonInteraction} interaction - Button interaction.
 * @returns {Promise<boolean>} True when the button was handled.
 * @skill-verified
 */
async function handleMembershipTicketCloseButton(interaction) {
  if (interaction.customId !== FORM_IDS.membershipCloseButton) {
    return false;
  }

  if (!interaction.inGuild() || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: 'Эту заявку нельзя закрыть здесь.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const leadershipRoles = await findLeadershipRoles(interaction.guild);

  if (!canCloseMembershipTicket(interaction, leadershipRoles)) {
    await interaction.reply({ content: 'Закрывать заявку может лидер, деп-лидер или админ.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const archiveCategory = await findArchiveCategory(interaction.guild);

  if (!archiveCategory) {
    await interaction.reply({ content: 'Не нашел категорию архива. Создай категорию с названием `архив` и нажми кнопку снова.', flags: MessageFlags.Ephemeral });
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await archiveMembershipTicket(interaction.channel, archiveCategory, leadershipRoles, interaction.user);
  await interaction.message.edit({ components: [buildMembershipTicketCloseButtonRow(true)] });
  await interaction.editReply(`Заявка закрыта и перенесена в категорию ${archiveCategory}.`);
  return true;
}

/**
 * Handles interactive form buttons.
 * @param {import('discord.js').ButtonInteraction} interaction - Button interaction.
 * @returns {Promise<boolean>} True when the button was handled.
 * @skill-verified
 */
async function handleFormButton(interaction) {
  if (await handleSalesStatusButton(interaction)) {
    return true;
  }

  if (await handleMembershipTicketCloseButton(interaction)) {
    return true;
  }

  if (interaction.customId === FORM_IDS.salesButton) {
    await interaction.showModal(buildSalesLotModal());
    return true;
  }

  if (interaction.customId === FORM_IDS.inviteButton) {
    await interaction.showModal(buildInviteRequestModal());
    return true;
  }

  if (interaction.customId === FORM_IDS.promotionButton) {
    await interaction.showModal(buildPromotionReportModal());
    return true;
  }

  const membershipType = getMembershipTypeFromButtonId(interaction.customId);

  if (membershipType) {
    await interaction.showModal(buildMembershipRequestModal(membershipType));
    return true;
  }

  return false;
}

/**
 * Handles sales lot modal submissions.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Modal submit interaction.
 * @returns {Promise<void>} Resolves after the sales lot is handled.
 * @skill-verified
 */
async function handleSalesLotModal(interaction) {
  const embed = buildSalesSubmissionEmbed(interaction.user, {
    item: getModalTextValue(interaction, FORM_IDS.salesItem),
    price: getModalTextValue(interaction, FORM_IDS.salesPrice),
    description: getModalTextValue(interaction, FORM_IDS.salesDescription),
    screenshot: getModalTextValue(interaction, FORM_IDS.salesScreenshot),
  });

  await sendSubmissionEmbed(interaction, embed, [buildSalesLotStatusButtonRow('active')]);
}

/**
 * Handles invite request modal submissions.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Modal submit interaction.
 * @returns {Promise<void>} Resolves after the invite request is handled.
 * @skill-verified
 */
async function handleInviteRequestModal(interaction) {
  const embed = buildInviteSubmissionEmbed(interaction.user, {
    requester: getModalTextValue(interaction, FORM_IDS.inviteRequester),
    guest: getModalTextValue(interaction, FORM_IDS.inviteGuest),
  });

  await sendSubmissionEmbed(interaction, embed);
}

/**
 * Handles promotion report modal submissions.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Modal submit interaction.
 * @returns {Promise<void>} Resolves after the promotion report is handled.
 * @skill-verified
 */
async function handlePromotionReportModal(interaction) {
  const embed = buildPromotionSubmissionEmbed(interaction.user, {
    nickname: getModalTextValue(interaction, FORM_IDS.promotionNickname),
    cid: getModalTextValue(interaction, FORM_IDS.promotionCid),
    currentRank: getModalTextValue(interaction, FORM_IDS.promotionCurrentRank),
    targetRank: getModalTextValue(interaction, FORM_IDS.promotionTargetRank),
    wood: getModalTextValue(interaction, FORM_IDS.promotionReport),
  });

  await sendSubmissionEmbed(interaction, embed);
}

/**
 * Handles membership request modal submissions.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Modal submit interaction.
 * @param {'family' | 'corp'} type - Membership request type.
 * @returns {Promise<void>} Resolves after the ticket is created.
 * @skill-verified
 */
async function handleMembershipRequestModal(interaction, type) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const ticketChannel = await createMembershipTicket(interaction, {
    type,
    nickname: getModalTextValue(interaction, FORM_IDS.membershipNickname),
    cid: getModalTextValue(interaction, FORM_IDS.membershipCid),
    rank: getModalTextValue(interaction, FORM_IDS.membershipRank),
  });

  await interaction.editReply(`Заявка создана: ${ticketChannel}`);
}

/**
 * Handles interactive modal submissions.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Modal submit interaction.
 * @returns {Promise<boolean>} True when the modal was handled.
 * @skill-verified
 */
async function handleFormModal(interaction) {
  if (interaction.customId === FORM_IDS.salesModal) {
    await handleSalesLotModal(interaction);
    return true;
  }

  if (interaction.customId === FORM_IDS.inviteModal) {
    await handleInviteRequestModal(interaction);
    return true;
  }

  if (interaction.customId === FORM_IDS.promotionModal) {
    await handlePromotionReportModal(interaction);
    return true;
  }

  const membershipType = getMembershipTypeFromModalId(interaction.customId);

  if (membershipType) {
    await handleMembershipRequestModal(interaction, membershipType);
    return true;
  }

  return false;
}

/**
 * Handles the /помощь command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleHelp(interaction) {
  const embed = createEmbed('KILLA FAMQ: команды', 'Пиши `/` и выбирай русские команды из списка Discord.', BRAND.quiet);

  for (const group of COMMAND_GROUPS) {
    const lines = [];

    for (const command of group.commands) {
      lines.push(`**/${command[0]}** - ${command[1]}`);
    }

    embed.addFields({ name: group.name, value: lines.join('\n') });
  }

  await replyPrivate(interaction, { embeds: [embed] });
}

/**
 * Handles the /правила command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleRules(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const rules = await getGuildRules(interaction.guildId);
  const embed = createEmbed('Правила сервера', formatRules(rules), BRAND.quiet);
  await replyPublic(interaction, { embeds: [embed] });
}

/**
 * Handles the /сервер command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleServer(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const guild = interaction.guild;
  const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`;
  const embed = createEmbed('Сервер', `**${guild.name}**`, BRAND.quiet)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: 'Участники', value: String(guild.memberCount), inline: true },
      { name: 'Каналы', value: String(guild.channels.cache.size), inline: true },
      { name: 'Создан', value: createdAt, inline: true },
    );

  await replyPrivate(interaction, { embeds: [embed] });
}

/**
 * Handles the /правила-настроить command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleRulesSetup(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'установить') {
    const text = interaction.options.getString('текст', true);
    const rules = parseRules(text);

    if (rules.length === 0) {
      await replyPrivate(interaction, 'Не вижу ни одного правила в тексте.');
      return;
    }

    await setGuildRules(interaction.guildId, rules);
    await replyPrivate(interaction, `Готово: сохранено правил - ${rules.length}.`);
    return;
  }

  if (subcommand === 'добавить') {
    const rule = interaction.options.getString('правило', true).trim();
    const rules = await addGuildRule(interaction.guildId, rule);
    await replyPrivate(interaction, `Правило добавлено. Всего правил: ${rules.length}.`);
    return;
  }

  if (subcommand === 'очистить') {
    await clearGuildRules(interaction.guildId);
    await replyPrivate(interaction, 'Правила очищены.');
  }
}

/**
 * Handles the /очистить command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleClear(interaction) {
  if (!(await ensureGuildInteraction(interaction)) || !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageMessages, 'Управлять сообщениями'))) {
    return;
  }

  const amount = interaction.options.getInteger('количество', true);

  if (!interaction.channel || !interaction.channel.isTextBased() || !('bulkDelete' in interaction.channel)) {
    await replyPrivate(interaction, 'В этом канале нельзя массово удалять сообщения.');
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const deleted = await interaction.channel.bulkDelete(amount, true);
  await interaction.editReply(`Удалено сообщений: ${deleted.size}. Старые сообщения старше 14 дней Discord не дает удалять пачкой.`);
}

/**
 * Handles the /мут command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleMute(interaction) {
  if (!(await ensureGuildInteraction(interaction)) || !(await ensureBotPermission(interaction, PermissionFlagsBits.ModerateMembers, 'Модерировать участников'))) {
    return;
  }

  const member = await getRequiredMember(interaction, 'пользователь');

  if (!member) {
    return;
  }

  if (!member.moderatable) {
    await replyPrivate(interaction, 'Я не могу выдать тайм-аут этому пользователю: роль выше моей или это владелец сервера.');
    return;
  }

  const minutes = interaction.options.getInteger('минуты', true);
  const reason = interaction.options.getString('причина');
  await member.timeout(minutes * 60 * 1000, buildAuditReason(interaction, reason));
  await replyPublic(interaction, { embeds: [createEmbed('Тайм-аут выдан', `<@${member.id}> получил тайм-аут на ${minutes} мин.`, BRAND.warn)] });
}

/**
 * Handles the /размут command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleUnmute(interaction) {
  if (!(await ensureGuildInteraction(interaction)) || !(await ensureBotPermission(interaction, PermissionFlagsBits.ModerateMembers, 'Модерировать участников'))) {
    return;
  }

  const member = await getRequiredMember(interaction, 'пользователь');

  if (!member) {
    return;
  }

  if (!member.moderatable) {
    await replyPrivate(interaction, 'Я не могу менять тайм-аут этого пользователя: роль выше моей или это владелец сервера.');
    return;
  }

  const reason = interaction.options.getString('причина');
  await member.timeout(null, buildAuditReason(interaction, reason));
  await replyPublic(interaction, { embeds: [createEmbed('Тайм-аут снят', `<@${member.id}> снова может писать.`, BRAND.ok)] });
}

/**
 * Handles the /кик command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleKick(interaction) {
  if (!(await ensureGuildInteraction(interaction)) || !(await ensureBotPermission(interaction, PermissionFlagsBits.KickMembers, 'Кикать участников'))) {
    return;
  }

  const member = await getRequiredMember(interaction, 'пользователь');

  if (!member) {
    return;
  }

  if (!member.kickable) {
    await replyPrivate(interaction, 'Я не могу кикнуть этого пользователя: роль выше моей или это владелец сервера.');
    return;
  }

  const reason = interaction.options.getString('причина');
  await member.kick(buildAuditReason(interaction, reason));
  await replyPublic(interaction, { embeds: [createEmbed('Пользователь кикнут', `<@${member.id}> был кикнут с сервера.`, BRAND.warn)] });
}

/**
 * Handles the /бан command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleBan(interaction) {
  if (!(await ensureGuildInteraction(interaction)) || !(await ensureBotPermission(interaction, PermissionFlagsBits.BanMembers, 'Банить участников'))) {
    return;
  }

  const user = interaction.options.getUser('пользователь', true);
  const member = interaction.options.getMember('пользователь');

  if (member && !member.bannable) {
    await replyPrivate(interaction, 'Я не могу забанить этого пользователя: роль выше моей или это владелец сервера.');
    return;
  }

  const reason = interaction.options.getString('причина');
  const days = interaction.options.getInteger('удалить-дни') || 0;
  await interaction.guild.members.ban(user.id, {
    deleteMessageSeconds: days * 24 * 60 * 60,
    reason: buildAuditReason(interaction, reason),
  });
  await replyPublic(interaction, { embeds: [createEmbed('Пользователь забанен', `<@${user.id}> получил бан.`, BRAND.danger)] });
}

/**
 * Handles the /разбан command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleUnban(interaction) {
  if (!(await ensureGuildInteraction(interaction)) || !(await ensureBotPermission(interaction, PermissionFlagsBits.BanMembers, 'Банить участников'))) {
    return;
  }

  const userId = interaction.options.getString('id', true).trim();
  const reason = interaction.options.getString('причина');
  await interaction.guild.members.unban(userId, buildAuditReason(interaction, reason));
  await replyPublic(interaction, { embeds: [createEmbed('Бан снят', `Пользователь с ID ${userId} разбанен.`, BRAND.ok)] });
}

/**
 * Handles the /предупредить command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleWarn(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const member = await getRequiredMember(interaction, 'пользователь');

  if (!member) {
    return;
  }

  const reason = interaction.options.getString('причина', true).trim();
  const warnings = await addWarning(interaction.guildId, member.id, {
    reason,
    moderatorId: interaction.user.id,
    createdAt: new Date().toISOString(),
  });
  const embed = createEmbed('Предупреждение выдано', `<@${member.id}> получил предупреждение.\nВсего предупреждений: ${warnings.length}.`, BRAND.warn);
  await replyPublic(interaction, { embeds: [embed] });
}

/**
 * Handles the /предупреждения command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleWarnings(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const member = await getRequiredMember(interaction, 'пользователь');

  if (!member) {
    return;
  }

  const warnings = await getWarnings(interaction.guildId, member.id);
  const embed = createEmbed(`Предупреждения: ${member.user.tag}`, formatWarnings(warnings), BRAND.quiet);
  await replyPrivate(interaction, { embeds: [embed] });
}

/**
 * Handles the /снять-предупреждения command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleClearWarnings(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const member = await getRequiredMember(interaction, 'пользователь');

  if (!member) {
    return;
  }

  const removed = await clearWarnings(interaction.guildId, member.id);
  await replyPrivate(interaction, `Очищено предупреждений для ${member.user.tag}: ${removed}.`);
}

/**
 * Handles the /замедлить command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleSlowmode(interaction) {
  if (!(await ensureGuildInteraction(interaction)) || !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageChannels, 'Управлять каналами'))) {
    return;
  }

  if (!interaction.channel || !interaction.channel.isTextBased() || !('setRateLimitPerUser' in interaction.channel)) {
    await replyPrivate(interaction, 'В этом канале нельзя настроить slowmode.');
    return;
  }

  const seconds = interaction.options.getInteger('секунды', true);
  await interaction.channel.setRateLimitPerUser(seconds, buildAuditReason(interaction, `Slowmode: ${seconds} сек.`));
  await replyPublic(interaction, { embeds: [createEmbed('Slowmode обновлен', `Теперь задержка в канале: ${seconds} сек.`, BRAND.ok)] });
}

/**
 * Handles the /объявление command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleAnnouncement(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const channel = getTargetTextChannel(interaction, 'канал');

  if (!channel || !('send' in channel)) {
    await replyPrivate(interaction, 'Не нашел текстовый канал для объявления.');
    return;
  }

  const text = interaction.options.getString('текст', true).trim();
  const embed = createEmbed('Объявление', text, BRAND.color);
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  await replyPrivate(interaction, `Объявление отправлено в ${channel}.`);
}

/**
 * Handles the /сказать command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handleSay(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const channel = getTargetTextChannel(interaction, 'канал');

  if (!channel || !('send' in channel)) {
    await replyPrivate(interaction, 'Не нашел текстовый канал для сообщения.');
    return;
  }

  const text = interaction.options.getString('текст', true).trim();

  if (!text) {
    await replyPrivate(interaction, 'Сообщение не должно быть пустым.');
    return;
  }

  await channel.send({ content: text, allowedMentions: { parse: [] } });
  await replyPrivate(interaction, `Сообщение отправлено в ${channel}.`);
}

/**
 * Handles the /опрос command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after handling the command.
 * @skill-verified
 */
async function handlePoll(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const channel = getTargetTextChannel(interaction, 'канал');

  if (!channel || !('send' in channel)) {
    await replyPrivate(interaction, 'Не нашел текстовый канал для опроса.');
    return;
  }

  const question = interaction.options.getString('вопрос', true).trim();
  const options = parsePollOptions(interaction.options.getString('варианты', true));

  if (options.length < 2 || options.length > 10) {
    await replyPrivate(interaction, 'Для опроса нужно от 2 до 10 вариантов через `;`.');
    return;
  }

  const embed = createEmbed(question, formatPollOptions(options), BRAND.quiet).setAuthor({ name: `Опрос от ${interaction.user.tag}` });
  const message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });

  for (let index = 0; index < options.length; index += 1) {
    await message.react(POLL_EMOJIS[index]);
  }

  await replyPrivate(interaction, `Опрос отправлен в ${channel}.`);
}

/**
 * Returns an optional selected text channel for price publishing.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @param {string} optionName - Channel option name.
 * @returns {import('discord.js').GuildTextBasedChannel | null} Selected text channel or null.
 * @skill-verified
 */
function getOptionalSelectedTextChannel(interaction, optionName) {
  const selectedChannel = interaction.options.getChannel(optionName);

  if (!selectedChannel) {
    return null;
  }

  if (!selectedChannel.isTextBased() || selectedChannel.type === ChannelType.DM || !('send' in selectedChannel)) {
    throw new Error('Выбранный канал не подходит для публикации прайса.');
  }

  return selectedChannel;
}

/**
 * Handles the /прайс command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after the price list is shown.
 * @skill-verified
 */
async function handlePriceList(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  const priceList = await getGuildPriceList(interaction.guildId);
  await replyPrivate(interaction, { embeds: [buildPriceListEmbed(priceList)] });
}

/**
 * Handles the /прайс-настроить command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after the price setting command is handled.
 * @skill-verified
 */
async function handlePriceSetup(interaction) {
  if (!(await ensureGuildInteraction(interaction))) {
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'опубликовать') {
      await handlePricePublish(interaction);
      return;
    }

    if (subcommand === 'изменить') {
      await handlePriceUpdate(interaction);
      return;
    }

    if (subcommand === 'добавить') {
      await handlePriceAdd(interaction);
      return;
    }

    if (subcommand === 'удалить') {
      await handlePriceRemove(interaction);
      return;
    }

    await interaction.editReply('Не знаю такое действие для прайса.');
  } catch (error) {
    await interaction.editReply(error.message || 'Не получилось обновить прайс.');
  }
}

/**
 * Handles publishing the price list message.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after the price list is published.
 * @skill-verified
 */
async function handlePricePublish(interaction) {
  const channel = getOptionalSelectedTextChannel(interaction, 'канал');
  const result = await publishGuildPriceList(interaction.guild, { channel });
  await interaction.editReply(`Прайс обновлен в ${result.channel}: ${result.message.url}`);
}

/**
 * Handles updating one existing price.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after the price is updated.
 * @skill-verified
 */
async function handlePriceUpdate(interaction) {
  const itemName = interaction.options.getString('название', true);
  const price = interaction.options.getString('цена', true);
  const emoji = interaction.options.getString('эмодзи');
  const updateResult = await updateGuildPriceItem(interaction.guildId, itemName, {
    price,
    emoji,
    updatedById: interaction.user.id,
  });
  const publishResult = await publishGuildPriceList(interaction.guild, { priceList: updateResult.priceList });

  await interaction.editReply([
    `Цена обновлена: **${updateResult.item.emoji} ${updateResult.item.name}**`,
    `Было: **${updateResult.oldPrice}**`,
    `Стало: **${updateResult.item.price}**`,
    `Пост: ${publishResult.message.url}`,
  ].join('\n'));
}

/**
 * Handles adding one new price item.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after the price item is added.
 * @skill-verified
 */
async function handlePriceAdd(interaction) {
  const addResult = await addGuildPriceItem(interaction.guildId, {
    categoryId: interaction.options.getString('категория', true),
    name: interaction.options.getString('название', true),
    price: interaction.options.getString('цена', true),
    emoji: interaction.options.getString('эмодзи'),
    money: interaction.options.getBoolean('деньги') ?? true,
    updatedById: interaction.user.id,
  });
  const publishResult = await publishGuildPriceList(interaction.guild, { priceList: addResult.priceList });

  await interaction.editReply([
    `Ресурс добавлен в раздел **${addResult.groupTitle}**:`,
    `**${addResult.item.emoji} ${addResult.item.name} — ${addResult.item.price}${addResult.item.money ? ' 💵' : ''}**`,
    `Пост: ${publishResult.message.url}`,
  ].join('\n'));
}

/**
 * Handles removing one price item.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after the price item is removed.
 * @skill-verified
 */
async function handlePriceRemove(interaction) {
  const removeResult = await removeGuildPriceItem(
    interaction.guildId,
    interaction.options.getString('название', true),
    interaction.user.id,
  );
  const publishResult = await publishGuildPriceList(interaction.guild, { priceList: removeResult.priceList });

  await interaction.editReply([
    `Ресурс удален из раздела **${removeResult.groupTitle}**:`,
    `**${removeResult.item.emoji} ${removeResult.item.name}**`,
    `Пост: ${publishResult.message.url}`,
  ].join('\n'));
}

/**
 * Dispatches a slash command to its handler.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Slash command interaction.
 * @returns {Promise<void>} Resolves after the command is handled.
 * @skill-verified
 */
async function dispatchCommand(interaction) {
  switch (interaction.commandName) {
    case 'помощь':
      await handleHelp(interaction);
      break;
    case 'правила':
      await handleRules(interaction);
      break;
    case 'сервер':
      await handleServer(interaction);
      break;
    case 'правила-настроить':
      await handleRulesSetup(interaction);
      break;
    case 'очистить':
      await handleClear(interaction);
      break;
    case 'мут':
      await handleMute(interaction);
      break;
    case 'размут':
      await handleUnmute(interaction);
      break;
    case 'кик':
      await handleKick(interaction);
      break;
    case 'бан':
      await handleBan(interaction);
      break;
    case 'разбан':
      await handleUnban(interaction);
      break;
    case 'предупредить':
      await handleWarn(interaction);
      break;
    case 'предупреждения':
      await handleWarnings(interaction);
      break;
    case 'снять-предупреждения':
      await handleClearWarnings(interaction);
      break;
    case 'замедлить':
      await handleSlowmode(interaction);
      break;
    case 'сказать':
      await handleSay(interaction);
      break;
    case 'объявление':
      await handleAnnouncement(interaction);
      break;
    case 'опрос':
      await handlePoll(interaction);
      break;
    case 'прайс':
      await handlePriceList(interaction);
      break;
    case 'прайс-настроить':
      await handlePriceSetup(interaction);
      break;
    default:
      await replyPrivate(interaction, 'Я пока не знаю такую команду.');
  }
}

/**
 * Handles new Discord interactions.
 * @param {import('discord.js').Interaction} interaction - Discord interaction.
 * @returns {Promise<void>} Resolves after the interaction is handled.
 * @skill-verified
 */
async function handleInteraction(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      await dispatchCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleFormButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleFormModal(interaction);
    }
  } catch (error) {
    console.error(error);

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'Команда сорвалась с ошибкой. Подробности уже в консоли.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: 'Команда сорвалась с ошибкой. Подробности уже в консоли.', flags: MessageFlags.Ephemeral });
  }
}

/**
 * Handles the Discord ready event.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @returns {Promise<void>} Resolves after presence is set.
 * @skill-verified
 */
async function handleReady(client) {
  await client.user.setPresence({
    status: 'online',
    activities: [{ name: 'русские команды | /помощь', type: ActivityType.Watching }],
  });

  await sendStartupLogs(client);
  console.log(`KILLA FAMQ запущен как ${client.user.tag}.`);
}

/**
 * Starts the Discord bot.
 * @returns {Promise<void>} Resolves after login is initiated.
 * @skill-verified
 */
async function startBot() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: buildLogIntents(config), partials: buildLogPartials() });

  client.once(Events.ClientReady, handleReady);
  registerLogHandlers(client, config);
  client.on(Events.InteractionCreate, handleInteraction);

  await client.login(config.token);
}

await startBot();
