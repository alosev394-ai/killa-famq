import { EmbedBuilder } from 'discord.js';

const BRAND_NAME = 'KILLA FAMQ';
const BRAND_OK = 0x2fbf71;
const DIVIDER = '━━━━━━━━━━━━━━━━━━';

const CONTRIBUTION_POINTS = Object.freeze([
  '🪨 Горная порода / камень — 8 очков за 1 шт.',
  '🌲 Дерево — 2 очка за 1 шт.',
  '🌸 Любой цветок — 1 очко за 1 шт.',
  '🏭 Метка обслуживания — 8 очков за 1 шт.',
]);

const ADDITIONAL_CONTRIBUTION_POINTS = Object.freeze([
  '🥇 Золото — 10 очков за 1 шт.',
  '🪙 Самородок из платины — 10 очков за 1 шт.',
  '🛢️ Оцинкованная канистра — 8 очков за 1 шт.',
  '✨ Комок фольги — 3 очка за 1 шт.',
  '📜 Старинная печать — 2 очка за 1 шт.',
  '🔌 Обломки микросхем — 1 очко за 4 шт.',
]);

const PROMOTION_STEPS = Object.freeze([
  {
    from: '1 | NEW KILLA',
    to: '2 | KILLA',
    requirements: ['600 очков вклада', '1 день актива в корпорации'],
  },
  {
    from: '2 | KILLA',
    to: '3 | OLD KILLA',
    requirements: ['1500 очков вклада', '2 дня актива в корпорации'],
  },
  {
    from: '3 | OLD KILLA',
    to: '4 | MATCHER',
    requirements: ['2800 очков вклада', '3 дня актива в корпорации'],
  },
  {
    from: '4 | MATCHER',
    to: '5 | ORION',
    requirements: ['4500 очков вклада', '5 дней актива в корпорации'],
  },
  {
    from: '5 | ORION',
    to: '6 | RAVEN',
    requirements: ['7000 очков вклада', '7 дней актива в корпорации'],
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
    .setTitle('📈 СИСТЕМА ПОВЫШЕНИЯ KILLA FAMQ corp')
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
      '💎 Очки вклада / ресурсы',
      '',
      'Укажи общий счёт очков и какие ресурсы сдавал. Администрация проверит активность и склад.',
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
    'Повышение в корпорации идёт через очки вклада и активность.',
    'Чем больше ты сдаёшь ресурсов на склад и помогаешь корпорации — тем быстрее растёшь по рангам.',
    '',
    DIVIDER,
    '',
    '**💎 Как начисляются очки вклада**',
    CONTRIBUTION_POINTS.join('\n'),
    '',
    '**💰 Дополнительные ресурсы:**',
    ADDITIONAL_CONTRIBUTION_POINTS.join('\n'),
    '',
    DIVIDER,
    '',
    '**🔰 Повышение по системе**',
    buildPromotionStepList(),
    '',
    DIVIDER,
    '',
    '**📌 Важно**',
    '• В отчёте указывай общий счёт очков и список ресурсов.',
    '• Повышение могут отклонить, если не хватает очков вклада или актива.',
    '• Администрация сама проверяет склад и активность.',
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
