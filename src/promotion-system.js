import { EmbedBuilder } from 'discord.js';

const BRAND_NAME = 'KILLA FAMQ';
const BRAND_OK = 0x2fbf71;
const DIVIDER = '━━━━━━━━━━━━━━━━━━';

const RANKS = Object.freeze([
  '1 | NEW KILLA',
  '2 | KILLA',
  '3 | OLD KILLA',
  '4 | MATCHER',
  '5 | ORION',
  '6 | RAVEN',
  '7 | CHIPS',
  '8 | HGHT',
  '9 | DEPRA',
  '10 | GOSHA',
]);

const PROMOTION_STEPS = Object.freeze([
  {
    from: '1 | NEW KILLA',
    to: '2 | KILLA',
    requirements: ['500 дерева', '1 день в корпорации', 'без жалоб и нарушений'],
  },
  {
    from: '2 | KILLA',
    to: '3 | OLD KILLA',
    requirements: ['1200 дерева', '2 дня активности', 'минимум 1 нормальный отчёт'],
  },
  {
    from: '3 | OLD KILLA',
    to: '4 | MATCHER',
    requirements: ['2200 дерева', '3 активных дня', 'знание правил корпорации и актуальных расценок'],
  },
  {
    from: '4 | MATCHER',
    to: '5 | ORION',
    requirements: ['3500 дерева', '5 активных дней', 'стабильная работа без конфликтов'],
  },
  {
    from: '5 | ORION',
    to: '6 | RAVEN',
    requirements: ['5000 дерева', '7 активных дней', 'помощь новичкам или польза для состава'],
  },
]);

/**
 * Builds the promotion system embed.
 * @returns {EmbedBuilder} Promotion system embed.
 * @skill-verified
 */
export function buildPromotionSystemEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_OK)
    .setTitle('📈 СИСТЕМА ПОВЫШЕНИЯ')
    .setDescription(buildPromotionSystemDescription())
    .setFooter({ text: `${BRAND_NAME} • Система повышения` })
    .setTimestamp();
}

/**
 * Builds the promotion report form embed.
 * @returns {EmbedBuilder} Promotion report form embed.
 * @skill-verified
 */
export function buildPromotionReportFormEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_OK)
    .setTitle('🧾 Отчёт на повышение')
    .setDescription([
      'Чтобы оставить отчёт, нажми кнопку ниже и заполни форму.',
      '',
      '**В форме нужно указать:**',
      '👤 Ваш ник',
      '🆔 Ваш CID',
      '🎖️ Текущий ранг',
      '📈 Ранг, на который хочешь повыситься',
      '🪵 Сколько дерева сдал и ссылки на доказательства',
      '',
      'Отчёт без доказательств или с неверными данными может быть отклонён.',
    ].join('\n'))
    .setFooter({ text: `${BRAND_NAME} • Отчёты на повышение` })
    .setTimestamp();
}

/**
 * Builds the full promotion system description.
 * @returns {string} Promotion system description.
 * @skill-verified
 */
function buildPromotionSystemDescription() {
  return [
    'Основное направление корпорации - дерево. Повышение до 6 ранга идёт через активность, сдачу ресурсов и нормальное поведение в составе.',
    '',
    '**🏷️ Ранги корпорации**',
    RANKS.join('\n'),
    '',
    DIVIDER,
    '',
    '**🪵 Повышение по системе**',
    buildPromotionStepList(),
    '',
    DIVIDER,
    '',
    '**🔒 Доверительные ранги**',
    '7 | CHIPS, 8 | HGHT и 9 | DEPRA выдаются только по доверию руководства.',
    '10 | GOSHA - руководящий ранг.',
    '',
    '**📌 Важно**',
    '• В отчёте указывай дерево, дни активности и ссылки на скрины/видео.',
    '• Повышение могут отклонить за конфликты, обман, нарушение правил или слабые доказательства.',
    '• Администрация может попросить дополнительный скрин, если отчёт непонятный.',
  ].join('\n');
}

/**
 * Builds formatted promotion step lines.
 * @returns {string} Promotion step list.
 * @skill-verified
 */
function buildPromotionStepList() {
  return PROMOTION_STEPS.map(formatPromotionStep).join('\n\n');
}

/**
 * Formats one promotion step.
 * @param {{ from: string, to: string, requirements: string[] }} step - Promotion step data.
 * @returns {string} Formatted promotion step.
 * @skill-verified
 */
function formatPromotionStep(step) {
  return [
    `**${step.from} → ${step.to}**`,
    ...step.requirements.map((requirement) => `• ${requirement}`),
  ].join('\n');
}
