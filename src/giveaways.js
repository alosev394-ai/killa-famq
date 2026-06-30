import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getGuildGiveaways, updateGuildState } from './store.js';

export const GIVEAWAY_IDS = Object.freeze({
  joinPrefix: 'killa_giveaway_join:',
});

/**
 * Creates a compact unique giveaway ID.
 * @returns {string} Giveaway ID.
 * @skill-verified
 */
function createGiveawayId() {
  return randomUUID().replaceAll('-', '').slice(0, 16);
}

/**
 * Creates a giveaway record before the Discord message is sent.
 * @param {{ guildId: string, channelId: string, prize: string, winnerCount: number, endsAt: string, createdById: string }} data - Giveaway data.
 * @returns {Record<string, unknown>} Giveaway record.
 * @skill-verified
 */
export function createGiveawayDraft(data) {
  return {
    id: createGiveawayId(),
    guildId: data.guildId,
    channelId: data.channelId,
    messageId: null,
    prize: data.prize,
    winnerCount: data.winnerCount,
    endsAt: data.endsAt,
    createdById: data.createdById,
    participantIds: [],
    winnerIds: [],
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Saves a giveaway record.
 * @param {string} guildId - Discord guild ID.
 * @param {Record<string, unknown>} giveaway - Giveaway record.
 * @returns {Promise<Record<string, unknown>>} Saved giveaway.
 * @skill-verified
 */
export function saveGuildGiveaway(guildId, giveaway) {
  /**
   * Saves the giveaway inside guild state.
   * @param {{ giveaways: Record<string, Record<string, unknown>> }} guildState - Guild state bucket.
   * @returns {Record<string, unknown>} Saved giveaway.
   * @skill-verified
   */
  function saveGiveaway(guildState) {
    guildState.giveaways[giveaway.id] = giveaway;
    return structuredClone(guildState.giveaways[giveaway.id]);
  }

  return updateGuildState(guildId, saveGiveaway);
}

/**
 * Returns active giveaways for a guild.
 * @param {string} guildId - Discord guild ID.
 * @returns {Promise<Record<string, unknown>[]>} Active giveaways.
 * @skill-verified
 */
export async function getActiveGiveaways(guildId) {
  const giveaways = await getGuildGiveaways(guildId);
  return Object.values(giveaways).filter((giveaway) => giveaway.status === 'active');
}

/**
 * Extracts a giveaway ID from a button custom ID.
 * @param {string} customId - Button custom ID.
 * @returns {string | null} Giveaway ID or null.
 * @skill-verified
 */
export function getGiveawayIdFromCustomId(customId) {
  return customId.startsWith(GIVEAWAY_IDS.joinPrefix) ? customId.slice(GIVEAWAY_IDS.joinPrefix.length) : null;
}

/**
 * Builds a giveaway participation button row.
 * @param {Record<string, unknown>} giveaway - Giveaway record.
 * @returns {ActionRowBuilder<ButtonBuilder>} Giveaway button row.
 * @skill-verified
 */
export function buildGiveawayButtonRow(giveaway) {
  const ended = giveaway.status !== 'active';

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${GIVEAWAY_IDS.joinPrefix}${giveaway.id}`)
      .setLabel(ended ? 'Завершено' : 'Участвовать')
      .setEmoji('🎉')
      .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(ended),
  );
}

/**
 * Builds a giveaway embed.
 * @param {Record<string, unknown>} giveaway - Giveaway record.
 * @returns {EmbedBuilder} Giveaway embed.
 * @skill-verified
 */
export function buildGiveawayEmbed(giveaway) {
  const ended = giveaway.status !== 'active';
  const endsAtSeconds = Math.floor(Date.parse(giveaway.endsAt) / 1000);
  const participantCount = Array.isArray(giveaway.participantIds) ? giveaway.participantIds.length : 0;
  const winnerIds = Array.isArray(giveaway.winnerIds) ? giveaway.winnerIds : [];

  const embed = new EmbedBuilder()
    .setColor(ended ? 0x22223b : 0x2fbf71)
    .setTitle(ended ? '🎉 Розыгрыш завершён' : '🎉 Новый розыгрыш')
    .setDescription(`**Приз:** ${giveaway.prize}`)
    .addFields(
      { name: 'Победителей', value: String(giveaway.winnerCount), inline: true },
      { name: 'Участников', value: String(participantCount), inline: true },
      { name: ended ? 'Завершён' : 'Закончится', value: `<t:${endsAtSeconds}:R>`, inline: true },
    )
    .setFooter({ text: 'KILLA FAMQ • Giveaway' })
    .setTimestamp();

  if (ended) {
    embed.addFields({ name: 'Победители', value: formatWinnerList(winnerIds) });
  }

  return embed;
}

/**
 * Formats giveaway winner mentions.
 * @param {string[]} winnerIds - Winner user IDs.
 * @returns {string} Formatted winner list.
 * @skill-verified
 */
function formatWinnerList(winnerIds) {
  if (winnerIds.length === 0) {
    return 'Нет победителей: участников не было.';
  }

  return winnerIds.map((winnerId) => `<@${winnerId}>`).join('\n');
}

/**
 * Adds one participant to an active giveaway.
 * @param {string} guildId - Discord guild ID.
 * @param {string} giveawayId - Giveaway ID.
 * @param {string} userId - Participant user ID.
 * @returns {Promise<{ status: 'added' | 'duplicate' | 'expired' | 'missing', giveaway: Record<string, unknown> | null }>} Participation result.
 * @skill-verified
 */
export function addGiveawayParticipant(guildId, giveawayId, userId) {
  /**
   * Adds the participant inside guild state.
   * @param {{ giveaways: Record<string, Record<string, unknown>> }} guildState - Guild state bucket.
   * @returns {{ status: 'added' | 'duplicate' | 'expired' | 'missing', giveaway: Record<string, unknown> | null }} Participation result.
   * @skill-verified
   */
  function addParticipant(guildState) {
    const giveaway = guildState.giveaways[giveawayId];

    if (!giveaway || giveaway.status !== 'active') {
      return { status: 'missing', giveaway: giveaway ? structuredClone(giveaway) : null };
    }

    if (Date.parse(giveaway.endsAt) <= Date.now()) {
      return { status: 'expired', giveaway: structuredClone(giveaway) };
    }

    giveaway.participantIds = Array.isArray(giveaway.participantIds) ? giveaway.participantIds : [];

    if (giveaway.participantIds.includes(userId)) {
      return { status: 'duplicate', giveaway: structuredClone(giveaway) };
    }

    giveaway.participantIds.push(userId);
    return { status: 'added', giveaway: structuredClone(giveaway) };
  }

  return updateGuildState(guildId, addParticipant);
}

/**
 * Finishes an active giveaway and chooses winners.
 * @param {string} guildId - Discord guild ID.
 * @param {string} giveawayId - Giveaway ID.
 * @returns {Promise<Record<string, unknown> | null>} Finished giveaway or null.
 * @skill-verified
 */
export function finishGuildGiveaway(guildId, giveawayId) {
  /**
   * Finishes the giveaway inside guild state.
   * @param {{ giveaways: Record<string, Record<string, unknown>> }} guildState - Guild state bucket.
   * @returns {Record<string, unknown> | null} Finished giveaway or null.
   * @skill-verified
   */
  function finishGiveaway(guildState) {
    const giveaway = guildState.giveaways[giveawayId];

    if (!giveaway) {
      return null;
    }

    if (giveaway.status !== 'active') {
      return structuredClone(giveaway);
    }

    const participantIds = Array.isArray(giveaway.participantIds) ? giveaway.participantIds : [];
    giveaway.winnerIds = pickWinners(participantIds, Number(giveaway.winnerCount) || 1);
    giveaway.status = 'ended';
    giveaway.finishedAt = new Date().toISOString();

    return structuredClone(giveaway);
  }

  return updateGuildState(guildId, finishGiveaway);
}

/**
 * Picks random unique winners from participants.
 * @param {string[]} participantIds - Participant user IDs.
 * @param {number} winnerCount - Requested winner count.
 * @returns {string[]} Winner IDs.
 * @skill-verified
 */
function pickWinners(participantIds, winnerCount) {
  const uniqueParticipants = [...new Set(participantIds)];
  const shuffled = [...uniqueParticipants];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, Math.max(0, Math.min(winnerCount, shuffled.length)));
}
