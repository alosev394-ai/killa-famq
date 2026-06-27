import { AuditLogEvent, ChannelType, EmbedBuilder, Events, GatewayIntentBits, PermissionFlagsBits, Partials } from 'discord.js';

const LOG_COLORS = {
  info: 0x3498db,
  ok: 0x2fbf71,
  warn: 0xf2c14e,
  danger: 0xd7263d,
  quiet: 0x2b2d31,
};

const LOG_CHANNEL_KEYWORDS = ['лог', 'logs', 'журнал'];
const MISSING_LOG_CHANNEL_GUILDS = new Set();
const MAX_FIELD_LENGTH = 1024;
const MAX_DESCRIPTION_LENGTH = 3900;
const VOICE_AUDIT_LOG_WINDOW_MS = 7000;
let activeConfig = {};

/**
 * Builds the gateway intents required by the logging module.
 * @param {{ enableMemberLogs?: boolean, enableMessageContentLogs?: boolean }} config - Runtime logging options.
 * @returns {number[]} Gateway intent bit values for the Discord client.
 * @skill-verified
 */
export function buildLogIntents(config) {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ];

  if (config.enableMemberLogs) {
    intents.push(GatewayIntentBits.GuildMembers);
  }

  if (config.enableMessageContentLogs) {
    intents.push(GatewayIntentBits.MessageContent);
  }

  return intents;
}

/**
 * Builds the partials used by the logging module.
 * @returns {number[]} Discord partial types for uncached log events.
 * @skill-verified
 */
export function buildLogPartials() {
  return [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User];
}

/**
 * Registers all server log event handlers on the client.
 * @param {import('discord.js').Client} client - Discord client to attach handlers to.
 * @param {Record<string, unknown>} config - Runtime configuration for log output.
 * @returns {void}
 * @skill-verified
 */
export function registerLogHandlers(client, config) {
  activeConfig = config;

  client.on(Events.InteractionCreate, handleInteractionLog);
  client.on(Events.MessageDelete, handleMessageDelete);
  client.on(Events.MessageBulkDelete, handleMessageBulkDelete);
  client.on(Events.MessageUpdate, handleMessageUpdate);
  client.on(Events.GuildMemberAdd, handleGuildMemberAdd);
  client.on(Events.GuildMemberRemove, handleGuildMemberRemove);
  client.on(Events.GuildMemberUpdate, handleGuildMemberUpdate);
  client.on(Events.GuildBanAdd, handleGuildBanAdd);
  client.on(Events.GuildBanRemove, handleGuildBanRemove);
  client.on(Events.ChannelCreate, handleChannelCreate);
  client.on(Events.ChannelDelete, handleChannelDelete);
  client.on(Events.ChannelUpdate, handleChannelUpdate);
  client.on(Events.VoiceStateUpdate, handleVoiceStateUpdate);
}

/**
 * Sends a startup log into every available guild log channel.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @returns {Promise<void>} Resolves after startup logs are sent.
 * @skill-verified
 */
export async function sendStartupLogs(client) {
  for (const [, guild] of client.guilds.cache) {
    await sendGuildLog(guild, buildLogEmbed('✅ Бот запущен', `KILLA FAMQ онлайн как **${client.user.tag}**.`, LOG_COLORS.ok));
  }
}

/**
 * Handles slash command usage logging.
 * @param {import('discord.js').Interaction} interaction - Discord interaction to inspect.
 * @returns {Promise<void>} Resolves after the interaction log is sent.
 * @skill-verified
 */
async function handleInteractionLog(interaction) {
  if (!interaction.inGuild() || !interaction.isChatInputCommand()) {
    return;
  }

  const embed = buildLogEmbed('⌨️ Команда использована', `/${interaction.commandName}`, LOG_COLORS.info)
    .addFields(
      buildField('Пользователь', formatUser(interaction.user), true),
      buildField('Канал', formatChannelReference(interaction.channel), true),
    );

  await sendGuildLog(interaction.guild, embed);
}

/**
 * Handles single message delete logging.
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} message - Deleted Discord message.
 * @returns {Promise<void>} Resolves after the delete log is sent.
 * @skill-verified
 */
async function handleMessageDelete(message) {
  if (!message.guild || isLogChannelId(message.guild, message.channelId)) {
    return;
  }

  const embed = buildLogEmbed('🗑️ Сообщение удалено', formatMessageContent(message.content), LOG_COLORS.danger)
    .addFields(
      buildField('Автор', message.author ? formatUser(message.author) : 'Неизвестно', true),
      buildField('Канал', formatChannelReference(message.channel), true),
    );

  const attachmentText = formatAttachments(message.attachments);

  if (attachmentText) {
    embed.addFields(buildField('Вложения', attachmentText, false));
  }

  await sendGuildLog(message.guild, embed);
}

/**
 * Handles bulk message delete logging.
 * @param {import('discord.js').Collection<string, import('discord.js').Message | import('discord.js').PartialMessage>} messages - Deleted messages.
 * @param {import('discord.js').GuildTextBasedChannel} channel - Channel where messages were deleted.
 * @returns {Promise<void>} Resolves after the bulk delete log is sent.
 * @skill-verified
 */
async function handleMessageBulkDelete(messages, channel) {
  if (!channel.guild || isLogChannelId(channel.guild, channel.id)) {
    return;
  }

  const embed = buildLogEmbed('🧹 Массовое удаление сообщений', `Удалено сообщений: **${messages.size}**`, LOG_COLORS.danger)
    .addFields(buildField('Канал', formatChannelReference(channel), true));

  const sample = formatDeletedMessageSample(messages);

  if (sample) {
    embed.addFields(buildField('Пример сообщений', sample, false));
  }

  await sendGuildLog(channel.guild, embed);
}

/**
 * Handles message edit logging.
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} oldMessage - Previous message state.
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} newMessage - New message state.
 * @returns {Promise<void>} Resolves after the edit log is sent.
 * @skill-verified
 */
async function handleMessageUpdate(oldMessage, newMessage) {
  if (!newMessage.guild || isLogChannelId(newMessage.guild, newMessage.channelId)) {
    return;
  }

  const oldContent = oldMessage.content || '';
  const newContent = newMessage.content || '';

  if (oldContent === newContent) {
    return;
  }

  const embed = buildLogEmbed('✏️ Сообщение изменено', formatMessageLink(newMessage), LOG_COLORS.warn)
    .addFields(
      buildField('Автор', newMessage.author ? formatUser(newMessage.author) : 'Неизвестно', true),
      buildField('Канал', formatChannelReference(newMessage.channel), true),
      buildField('Было', formatMessageContent(oldContent), false),
      buildField('Стало', formatMessageContent(newContent), false),
    );

  await sendGuildLog(newMessage.guild, embed);
}

/**
 * Handles member join logging.
 * @param {import('discord.js').GuildMember} member - Member who joined the guild.
 * @returns {Promise<void>} Resolves after the join log is sent.
 * @skill-verified
 */
async function handleGuildMemberAdd(member) {
  const embed = buildLogEmbed('👋 Участник зашёл', formatUser(member.user), LOG_COLORS.ok)
    .addFields(
      buildField('Аккаунт создан', formatTimestamp(member.user.createdTimestamp), true),
      buildField('Участников на сервере', String(member.guild.memberCount), true),
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }));

  await sendGuildLog(member.guild, embed);
}

/**
 * Handles member leave logging.
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} member - Member who left the guild.
 * @returns {Promise<void>} Resolves after the leave log is sent.
 * @skill-verified
 */
async function handleGuildMemberRemove(member) {
  const userText = member.user ? formatUser(member.user) : 'Неизвестный участник';
  const embed = buildLogEmbed('🚪 Участник вышел', userText, LOG_COLORS.warn)
    .addFields(buildField('Участников на сервере', String(member.guild.memberCount), true));

  if (member.user) {
    embed.setThumbnail(member.user.displayAvatarURL({ size: 128 }));
  }

  await sendGuildLog(member.guild, embed);
}

/**
 * Handles member profile, role, and timeout updates.
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} oldMember - Previous member state.
 * @param {import('discord.js').GuildMember} newMember - New member state.
 * @returns {Promise<void>} Resolves after relevant member update logs are sent.
 * @skill-verified
 */
async function handleGuildMemberUpdate(oldMember, newMember) {
  const fields = [];

  if (oldMember.nickname !== newMember.nickname) {
    fields.push(buildField('Ник был', oldMember.nickname || newMember.user.username, true));
    fields.push(buildField('Ник стал', newMember.nickname || newMember.user.username, true));
  }

  appendRoleChanges(fields, oldMember, newMember);
  appendTimeoutChange(fields, oldMember, newMember);

  if (fields.length === 0) {
    return;
  }

  const embed = buildLogEmbed('👤 Участник обновлён', formatUser(newMember.user), LOG_COLORS.info)
    .addFields(fields)
    .setThumbnail(newMember.user.displayAvatarURL({ size: 128 }));

  await sendGuildLog(newMember.guild, embed);
}

/**
 * Handles ban logging.
 * @param {import('discord.js').GuildBan} ban - Discord ban information.
 * @returns {Promise<void>} Resolves after the ban log is sent.
 * @skill-verified
 */
async function handleGuildBanAdd(ban) {
  const embed = buildLogEmbed('🔨 Пользователь забанен', formatUser(ban.user), LOG_COLORS.danger)
    .addFields(buildField('Причина', ban.reason || 'Не указана', false))
    .setThumbnail(ban.user.displayAvatarURL({ size: 128 }));

  await sendGuildLog(ban.guild, embed);
}

/**
 * Handles unban logging.
 * @param {import('discord.js').GuildBan} ban - Discord unban information.
 * @returns {Promise<void>} Resolves after the unban log is sent.
 * @skill-verified
 */
async function handleGuildBanRemove(ban) {
  const embed = buildLogEmbed('✅ Бан снят', formatUser(ban.user), LOG_COLORS.ok)
    .setThumbnail(ban.user.displayAvatarURL({ size: 128 }));

  await sendGuildLog(ban.guild, embed);
}

/**
 * Handles channel creation logging.
 * @param {import('discord.js').GuildBasedChannel} channel - Created channel.
 * @returns {Promise<void>} Resolves after the channel create log is sent.
 * @skill-verified
 */
async function handleChannelCreate(channel) {
  if (!channel.guild) {
    return;
  }

  const embed = buildLogEmbed('➕ Канал создан', formatChannelReference(channel), LOG_COLORS.ok)
    .addFields(buildField('Тип', formatChannelType(channel.type), true));

  await sendGuildLog(channel.guild, embed);
}

/**
 * Handles channel deletion logging.
 * @param {import('discord.js').GuildBasedChannel} channel - Deleted channel.
 * @returns {Promise<void>} Resolves after the channel delete log is sent.
 * @skill-verified
 */
async function handleChannelDelete(channel) {
  if (!channel.guild) {
    return;
  }

  const embed = buildLogEmbed('➖ Канал удалён', `#${channel.name}`, LOG_COLORS.danger)
    .addFields(buildField('Тип', formatChannelType(channel.type), true));

  await sendGuildLog(channel.guild, embed);
}

/**
 * Handles channel update logging.
 * @param {import('discord.js').GuildBasedChannel} oldChannel - Previous channel state.
 * @param {import('discord.js').GuildBasedChannel} newChannel - New channel state.
 * @returns {Promise<void>} Resolves after relevant channel update logs are sent.
 * @skill-verified
 */
async function handleChannelUpdate(oldChannel, newChannel) {
  if (!newChannel.guild) {
    return;
  }

  const fields = [];
  appendChangedField(fields, 'Название было', oldChannel.name, newChannel.name, true);
  appendChangedField(fields, 'Название стало', newChannel.name, oldChannel.name, true);
  appendChangedField(fields, 'Тема была', getChannelTopic(oldChannel), getChannelTopic(newChannel), false);
  appendChangedField(fields, 'Тема стала', getChannelTopic(newChannel), getChannelTopic(oldChannel), false);
  appendChangedField(fields, 'Slowmode был', formatRateLimit(oldChannel), formatRateLimit(newChannel), true);
  appendChangedField(fields, 'Slowmode стал', formatRateLimit(newChannel), formatRateLimit(oldChannel), true);

  if (fields.length === 0) {
    return;
  }

  const embed = buildLogEmbed('⚙️ Канал обновлён', formatChannelReference(newChannel), LOG_COLORS.info)
    .addFields(fields);

  await sendGuildLog(newChannel.guild, embed);
}

/**
 * Handles voice channel movement logging.
 * @param {import('discord.js').VoiceState} oldState - Previous voice state.
 * @param {import('discord.js').VoiceState} newState - New voice state.
 * @returns {Promise<void>} Resolves after the voice log is sent.
 * @skill-verified
 */
async function handleVoiceStateUpdate(oldState, newState) {
  const member = newState.member || oldState.member;

  if (!member || oldState.channelId === newState.channelId) {
    return;
  }

  const oldChannel = oldState.channel ? formatChannelReference(oldState.channel) : 'Не был в войсе';
  const newChannel = newState.channel ? formatChannelReference(newState.channel) : 'Вышел из войса';
  const moveAuditEntry = await findRecentVoiceMoveAuditEntry(newState);
  const title = getVoiceLogTitle(oldState.channelId, newState.channelId, moveAuditEntry);
  const color = newState.channelId ? LOG_COLORS.info : LOG_COLORS.warn;
  const embed = buildLogEmbed(title, formatUser(member.user), color)
    .addFields(
      buildField('Было', oldChannel, true),
      buildField('Стало', newChannel, true),
    );

  if (moveAuditEntry?.executor) {
    embed.addFields(buildField('Перенёс', formatUser(moveAuditEntry.executor), true));
  }

  await sendGuildLog(newState.guild, embed);
}

/**
 * Finds a recent audit-log entry for a moderator voice move.
 * @param {import('discord.js').VoiceState} state - New voice state.
 * @returns {Promise<import('discord.js').GuildAuditLogsEntry | null>} Recent move audit entry or null.
 * @skill-verified
 */
async function findRecentVoiceMoveAuditEntry(state) {
  const me = state.guild.members.me || await state.guild.members.fetchMe();

  if (!me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
    return null;
  }

  try {
    const auditLogs = await state.guild.fetchAuditLogs({ type: AuditLogEvent.MemberMove, limit: 5 });
    const now = Date.now();

    for (const [, entry] of auditLogs.entries) {
      if (now - entry.createdTimestamp > VOICE_AUDIT_LOG_WINDOW_MS) {
        continue;
      }

      if (isVoiceMoveEntryForState(entry, state)) {
        return entry;
      }
    }
  } catch (error) {
    console.error(`Не удалось прочитать audit log voice-переноса в ${state.guild.name}:`, error);
  }

  return null;
}

/**
 * Checks whether an audit entry likely belongs to the current voice state change.
 * @param {import('discord.js').GuildAuditLogsEntry} entry - Audit log entry.
 * @param {import('discord.js').VoiceState} state - New voice state.
 * @returns {boolean} True when the audit entry likely matches the move.
 * @skill-verified
 */
function isVoiceMoveEntryForState(entry, state) {
  const extraChannelId = entry.extra && typeof entry.extra === 'object' && 'channel' in entry.extra
    ? entry.extra.channel?.id
    : null;

  if (extraChannelId && state.channelId && extraChannelId !== state.channelId) {
    return false;
  }

  return Boolean(entry.executor && state.channelId);
}

/**
 * Adds role changes to an embed field list.
 * @param {import('discord.js').APIEmbedField[]} fields - Mutable embed fields.
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} oldMember - Previous member state.
 * @param {import('discord.js').GuildMember} newMember - New member state.
 * @returns {void}
 * @skill-verified
 */
function appendRoleChanges(fields, oldMember, newMember) {
  const addedRoles = [];
  const removedRoles = [];

  for (const [, role] of newMember.roles.cache) {
    if (role.id !== newMember.guild.id && !oldMember.roles.cache.has(role.id)) {
      addedRoles.push(role);
    }
  }

  for (const [, role] of oldMember.roles.cache) {
    if (role.id !== newMember.guild.id && !newMember.roles.cache.has(role.id)) {
      removedRoles.push(role);
    }
  }

  if (addedRoles.length > 0) {
    fields.push(buildField('Роли добавлены', formatRoleList(addedRoles), false));
  }

  if (removedRoles.length > 0) {
    fields.push(buildField('Роли сняты', formatRoleList(removedRoles), false));
  }
}

/**
 * Adds timeout changes to an embed field list.
 * @param {import('discord.js').APIEmbedField[]} fields - Mutable embed fields.
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} oldMember - Previous member state.
 * @param {import('discord.js').GuildMember} newMember - New member state.
 * @returns {void}
 * @skill-verified
 */
function appendTimeoutChange(fields, oldMember, newMember) {
  const oldTimeout = oldMember.communicationDisabledUntilTimestamp || 0;
  const newTimeout = newMember.communicationDisabledUntilTimestamp || 0;

  if (oldTimeout === newTimeout) {
    return;
  }

  fields.push(buildField('Тайм-аут был', oldTimeout ? formatTimestamp(oldTimeout) : 'Не было', true));
  fields.push(buildField('Тайм-аут стал', newTimeout ? formatTimestamp(newTimeout) : 'Снят', true));
}

/**
 * Adds a changed value pair into an embed field list.
 * @param {import('discord.js').APIEmbedField[]} fields - Mutable embed fields.
 * @param {string} label - Field label to add.
 * @param {string} currentValue - Current field value.
 * @param {string} compareValue - Value to compare against.
 * @param {boolean} inline - Whether the field should render inline.
 * @returns {void}
 * @skill-verified
 */
function appendChangedField(fields, label, currentValue, compareValue, inline) {
  if (currentValue === compareValue) {
    return;
  }

  fields.push(buildField(label, currentValue || 'Не указано', inline));
}

/**
 * Resolves the log channel for a guild.
 * @param {import('discord.js').Guild} guild - Guild to search in.
 * @returns {Promise<import('discord.js').GuildTextBasedChannel | null>} Usable log channel or null.
 * @skill-verified
 */
async function resolveLogChannel(guild) {
  if (activeConfig.logChannelId) {
    const explicitChannel = await fetchGuildChannel(guild, String(activeConfig.logChannelId));

    if (explicitChannel && await canSendLogToChannel(explicitChannel)) {
      return explicitChannel;
    }
  }

  await guild.channels.fetch();

  for (const [, channel] of guild.channels.cache) {
    if (isLogChannelCandidate(channel) && await canSendLogToChannel(channel)) {
      return channel;
    }
  }

  return null;
}

/**
 * Fetches a guild channel by ID without throwing.
 * @param {import('discord.js').Guild} guild - Guild to fetch from.
 * @param {string} channelId - Channel ID to fetch.
 * @returns {Promise<import('discord.js').GuildBasedChannel | null>} Found channel or null.
 * @skill-verified
 */
async function fetchGuildChannel(guild, channelId) {
  try {
    return await guild.channels.fetch(channelId);
  } catch {
    return null;
  }
}

/**
 * Sends an embed to the guild log channel.
 * @param {import('discord.js').Guild} guild - Guild where the log happened.
 * @param {EmbedBuilder} embed - Log embed to send.
 * @returns {Promise<void>} Resolves after the log is sent or skipped.
 * @skill-verified
 */
async function sendGuildLog(guild, embed) {
  const channel = await resolveLogChannel(guild);

  if (!channel) {
    warnMissingLogChannel(guild);
    return;
  }

  try {
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error(`Не удалось отправить лог в ${guild.name}:`, error);
  }
}

/**
 * Prints a missing log channel warning once per guild.
 * @param {import('discord.js').Guild} guild - Guild missing a log channel.
 * @returns {void}
 * @skill-verified
 */
function warnMissingLogChannel(guild) {
  if (MISSING_LOG_CHANNEL_GUILDS.has(guild.id)) {
    return;
  }

  MISSING_LOG_CHANNEL_GUILDS.add(guild.id);
  console.warn(`Канал логов не найден на сервере ${guild.name}. Создай канал с "логи" в названии или задай DISCORD_LOG_CHANNEL_ID.`);
}

/**
 * Checks whether a channel can be used as the log channel.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Channel to check.
 * @returns {Promise<boolean>} True when the bot can send embeds to the channel.
 * @skill-verified
 */
async function canSendLogToChannel(channel) {
  if (!channel || !channel.isTextBased() || channel.type === ChannelType.DM || !('send' in channel)) {
    return false;
  }

  const guild = channel.guild;
  const me = guild.members.me || await guild.members.fetchMe();
  const permissions = channel.permissionsFor(me);

  return Boolean(permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]));
}

/**
 * Checks whether a channel name looks like a log channel.
 * @param {import('discord.js').GuildBasedChannel | null} channel - Channel to inspect.
 * @returns {boolean} True when the channel name matches known log keywords.
 * @skill-verified
 */
function isLogChannelCandidate(channel) {
  if (!channel || !channel.isTextBased() || channel.type === ChannelType.DM || !('send' in channel)) {
    return false;
  }

  const normalizedName = normalizeChannelName(channel.name);

  for (const keyword of LOG_CHANNEL_KEYWORDS) {
    if (normalizedName.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a channel ID is the current guild log channel ID.
 * @param {import('discord.js').Guild} guild - Guild owning the channel.
 * @param {string | null} channelId - Channel ID to check.
 * @returns {boolean} True when the channel should be skipped for recursive logs.
 * @skill-verified
 */
function isLogChannelId(guild, channelId) {
  if (!channelId) {
    return false;
  }

  if (activeConfig.logChannelId && channelId === activeConfig.logChannelId) {
    return true;
  }

  const channel = guild.channels.cache.get(channelId);
  return isLogChannelCandidate(channel);
}

/**
 * Normalizes a channel name for loose keyword matching.
 * @param {string} name - Raw channel name.
 * @returns {string} Lowercase searchable channel name.
 * @skill-verified
 */
function normalizeChannelName(name) {
  return name.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

/**
 * Creates a base log embed.
 * @param {string} title - Log title.
 * @param {string} description - Log description.
 * @param {number} color - Embed color.
 * @returns {EmbedBuilder} Configured log embed.
 * @skill-verified
 */
function buildLogEmbed(title, description, color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(limitText(description || 'Нет данных', MAX_DESCRIPTION_LENGTH))
    .setFooter({ text: 'KILLA FAMQ • Логи сервера' })
    .setTimestamp();
}

/**
 * Builds a safe embed field object.
 * @param {string} name - Field name.
 * @param {string} value - Field value.
 * @param {boolean} inline - Whether the field should be inline.
 * @returns {import('discord.js').APIEmbedField} Discord embed field.
 * @skill-verified
 */
function buildField(name, value, inline) {
  return {
    name,
    value: limitText(value || 'Нет данных', MAX_FIELD_LENGTH),
    inline,
  };
}

/**
 * Formats a Discord user for logs.
 * @param {import('discord.js').User} user - User to format.
 * @returns {string} User mention.
 * @skill-verified
 */
function formatUser(user) {
  return `<@${user.id}>`;
}

/**
 * Formats a channel reference for logs.
 * @param {import('discord.js').Channel | null} channel - Channel to format.
 * @returns {string} Channel mention or fallback text.
 * @skill-verified
 */
function formatChannelReference(channel) {
  if (!channel) {
    return 'Канал недоступен';
  }

  if ('guild' in channel && 'name' in channel) {
    return `<#${channel.id}>`;
  }

  return 'Канал недоступен';
}

/**
 * Formats message content for embed display.
 * @param {string | null | undefined} content - Message content.
 * @returns {string} Safe message content for a log embed.
 * @skill-verified
 */
function formatMessageContent(content) {
  if (!content) {
    return 'Текст недоступен.';
  }

  return limitText(content, MAX_DESCRIPTION_LENGTH);
}

/**
 * Formats message attachments.
 * @param {import('discord.js').Collection<string, import('discord.js').Attachment> | undefined} attachments - Message attachments.
 * @returns {string} Formatted attachment links or an empty string.
 * @skill-verified
 */
function formatAttachments(attachments) {
  if (!attachments || attachments.size === 0) {
    return '';
  }

  const lines = [];

  for (const [, attachment] of attachments) {
    lines.push(`[${attachment.name || 'Файл'}](${attachment.url})`);

    if (lines.length >= 5) {
      break;
    }
  }

  if (attachments.size > lines.length) {
    lines.push(`И ещё: ${attachments.size - lines.length}`);
  }

  return lines.join('\n');
}

/**
 * Formats a sample of deleted messages from a bulk delete event.
 * @param {import('discord.js').Collection<string, import('discord.js').Message | import('discord.js').PartialMessage>} messages - Deleted messages.
 * @returns {string} Short sample for an embed field.
 * @skill-verified
 */
function formatDeletedMessageSample(messages) {
  const lines = [];

  for (const [, message] of messages) {
    const author = message.author ? formatUser(message.author) : 'Неизвестно';
    const text = message.content || 'текст недоступен';
    lines.push(`• ${author}: ${limitText(text, 120)}`);

    if (lines.length >= 5) {
      break;
    }
  }

  return lines.join('\n');
}

/**
 * Formats a message jump link.
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} message - Message to link.
 * @returns {string} Discord message URL.
 * @skill-verified
 */
function formatMessageLink(message) {
  return `[Открыть сообщение](https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id})`;
}

/**
 * Formats a Discord timestamp.
 * @param {number} timestamp - Millisecond timestamp.
 * @returns {string} Discord timestamp markup.
 * @skill-verified
 */
function formatTimestamp(timestamp) {
  const seconds = Math.floor(timestamp / 1000);
  return `<t:${seconds}:F>\n<t:${seconds}:R>`;
}

/**
 * Formats a list of roles.
 * @param {import('discord.js').Role[]} roles - Roles to format.
 * @returns {string} Role mention list.
 * @skill-verified
 */
function formatRoleList(roles) {
  const lines = [];

  for (const role of roles) {
    lines.push(`<@&${role.id}>`);
  }

  return lines.join('\n');
}

/**
 * Returns a channel topic when the channel supports topics.
 * @param {import('discord.js').GuildBasedChannel} channel - Channel to inspect.
 * @returns {string} Channel topic or an empty string.
 * @skill-verified
 */
function getChannelTopic(channel) {
  if ('topic' in channel && channel.topic) {
    return channel.topic;
  }

  return '';
}

/**
 * Formats a channel rate limit.
 * @param {import('discord.js').GuildBasedChannel} channel - Channel to inspect.
 * @returns {string} Slowmode label.
 * @skill-verified
 */
function formatRateLimit(channel) {
  if ('rateLimitPerUser' in channel) {
    return `${channel.rateLimitPerUser || 0} сек.`;
  }

  return '';
}

/**
 * Formats a Discord channel type.
 * @param {number} type - Discord channel type.
 * @returns {string} Human-readable channel type.
 * @skill-verified
 */
function formatChannelType(type) {
  switch (type) {
    case ChannelType.GuildText:
      return 'Текстовый';
    case ChannelType.GuildVoice:
      return 'Голосовой';
    case ChannelType.GuildCategory:
      return 'Категория';
    case ChannelType.GuildAnnouncement:
      return 'Объявления';
    case ChannelType.GuildForum:
      return 'Форум';
    case ChannelType.GuildStageVoice:
      return 'Сцена';
    default:
      return `Тип ${type}`;
  }
}

/**
 * Chooses a voice log title from channel movement.
 * @param {string | null} oldChannelId - Previous voice channel ID.
 * @param {string | null} newChannelId - New voice channel ID.
 * @param {import('discord.js').GuildAuditLogsEntry | null} moveAuditEntry - Recent voice move audit entry.
 * @returns {string} Voice log title.
 * @skill-verified
 */
function getVoiceLogTitle(oldChannelId, newChannelId, moveAuditEntry = null) {
  if (moveAuditEntry) {
    return '🔁 Участника перенесли в другой войс';
  }

  if (!oldChannelId && newChannelId) {
    return '🔊 Участник вошёл в войс';
  }

  if (oldChannelId && !newChannelId) {
    return '🔇 Участник вышел из войса';
  }

  return '🔁 Участник перешёл в другой войс';
}

/**
 * Limits text to Discord embed limits.
 * @param {string} value - Text to limit.
 * @param {number} maxLength - Maximum output length.
 * @returns {string} Text truncated with an ellipsis when needed.
 * @skill-verified
 */
function limitText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
