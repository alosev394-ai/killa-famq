import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

export const FORM_IDS = Object.freeze({
  roleButton: 'killa_role_request_open',
  roleModal: 'killa_role_request_submit',
  roleNickname: 'role_nickname',
  roleStatic: 'role_static',
  roleScreenshot: 'role_screenshot',
  salesButton: 'killa_sales_lot_open',
  salesModal: 'killa_sales_lot_submit',
  salesItem: 'sales_item',
  salesPrice: 'sales_price',
  salesDescription: 'sales_description',
  salesScreenshot: 'sales_screenshot',
  salesStatusActive: 'killa_sales_status_active',
  salesStatusInactive: 'killa_sales_status_inactive',
  inviteButton: 'killa_invite_request_open',
  inviteModal: 'killa_invite_request_submit',
  inviteRequester: 'invite_requester',
  inviteGuest: 'invite_guest',
  promotionButton: 'killa_promotion_report_open',
  promotionModal: 'killa_promotion_report_submit',
  promotionNickname: 'promotion_nickname',
  promotionCid: 'promotion_cid',
  promotionCurrentRank: 'promotion_current_rank',
  promotionTargetRank: 'promotion_target_rank',
  promotionReport: 'promotion_report',
});

/**
 * Creates a button action row.
 * @param {string} customId - Button custom ID.
 * @param {string} label - Button label.
 * @param {ButtonStyle} style - Button style.
 * @returns {ActionRowBuilder<ButtonBuilder>} Button action row.
 * @skill-verified
 */
function createButtonRow(customId, label, style) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style),
  );
}

/**
 * Creates a text input action row for a modal.
 * @param {string} customId - Text input custom ID.
 * @param {string} label - Text input label.
 * @param {TextInputStyle} style - Text input style.
 * @param {boolean} required - Whether the field is required.
 * @param {number} maxLength - Maximum field length.
 * @param {string} placeholder - Field placeholder.
 * @returns {ActionRowBuilder<TextInputBuilder>} Text input action row.
 * @skill-verified
 */
function createTextInputRow(customId, label, style, required, maxLength, placeholder) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required)
      .setMaxLength(maxLength)
      .setPlaceholder(placeholder),
  );
}

/**
 * Builds the role request button row.
 * @returns {ActionRowBuilder<ButtonBuilder>} Role request button row.
 * @skill-verified
 */
export function buildRoleRequestButtonRow() {
  return createButtonRow(FORM_IDS.roleButton, 'Создать заявку', ButtonStyle.Secondary);
}

/**
 * Builds the sales lot button row.
 * @returns {ActionRowBuilder<ButtonBuilder>} Sales lot button row.
 * @skill-verified
 */
export function buildSalesLotButtonRow() {
  return createButtonRow(FORM_IDS.salesButton, 'Создать лот', ButtonStyle.Success);
}

/**
 * Builds the sales lot status button row.
 * @param {'active' | 'inactive'} status - Current lot status.
 * @returns {ActionRowBuilder<ButtonBuilder>} Sales lot status button row.
 * @skill-verified
 */
export function buildSalesLotStatusButtonRow(status = 'active') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(FORM_IDS.salesStatusActive)
      .setLabel('Актуально')
      .setStyle(ButtonStyle.Success)
      .setDisabled(status === 'active'),
    new ButtonBuilder()
      .setCustomId(FORM_IDS.salesStatusInactive)
      .setLabel('Неактуально')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(status === 'inactive'),
  );
}

/**
 * Builds the invite request button row.
 * @returns {ActionRowBuilder<ButtonBuilder>} Invite request button row.
 * @skill-verified
 */
export function buildInviteRequestButtonRow() {
  return createButtonRow(FORM_IDS.inviteButton, 'Создать заявку', ButtonStyle.Success);
}

/**
 * Builds the promotion report button row.
 * @returns {ActionRowBuilder<ButtonBuilder>} Promotion report button row.
 * @skill-verified
 */
export function buildPromotionReportButtonRow() {
  return createButtonRow(FORM_IDS.promotionButton, 'Создать отчёт', ButtonStyle.Success);
}

/**
 * Builds the role request modal.
 * @returns {ModalBuilder} Role request modal.
 * @skill-verified
 */
export function buildRoleRequestModal() {
  return new ModalBuilder()
    .setCustomId(FORM_IDS.roleModal)
    .setTitle('Подача на получение роли')
    .addComponents(
      createTextInputRow(FORM_IDS.roleNickname, 'Игровой ник', TextInputStyle.Short, true, 100, 'Например: Killa_Famq'),
      createTextInputRow(FORM_IDS.roleStatic, 'Статик / ID', TextInputStyle.Short, true, 100, 'Например: 12345'),
      createTextInputRow(FORM_IDS.roleScreenshot, 'Скрин F2 - Персонаж', TextInputStyle.Paragraph, true, 500, 'Вставь ссылку на скриншот'),
    );
}

/**
 * Builds the sales lot modal.
 * @returns {ModalBuilder} Sales lot modal.
 * @skill-verified
 */
export function buildSalesLotModal() {
  return new ModalBuilder()
    .setCustomId(FORM_IDS.salesModal)
    .setTitle('Создать лот')
    .addComponents(
      createTextInputRow(FORM_IDS.salesItem, 'Товар', TextInputStyle.Short, true, 100, 'Что продаешь'),
      createTextInputRow(FORM_IDS.salesPrice, 'Цена', TextInputStyle.Short, true, 100, 'Например: 50 000$'),
      createTextInputRow(FORM_IDS.salesDescription, 'Описание', TextInputStyle.Paragraph, false, 700, 'Можно оставить пустым'),
      createTextInputRow(FORM_IDS.salesScreenshot, 'Скрин', TextInputStyle.Paragraph, true, 500, 'Вставь ссылку на скриншот'),
    );
}

/**
 * Builds the invite request modal.
 * @returns {ModalBuilder} Invite request modal.
 * @skill-verified
 */
export function buildInviteRequestModal() {
  return new ModalBuilder()
    .setCustomId(FORM_IDS.inviteModal)
    .setTitle('Заявка на инвайт')
    .addComponents(
      createTextInputRow(FORM_IDS.inviteRequester, 'Ваш ник | CID', TextInputStyle.Short, true, 100, 'Например: Гоша Килла | 122'),
      createTextInputRow(FORM_IDS.inviteGuest, 'Ник | CID приглашённого', TextInputStyle.Short, true, 100, 'Например: Саня | 345'),
    );
}

/**
 * Builds the promotion report modal.
 * @returns {ModalBuilder} Promotion report modal.
 * @skill-verified
 */
export function buildPromotionReportModal() {
  return new ModalBuilder()
    .setCustomId(FORM_IDS.promotionModal)
    .setTitle('Отчёт на повышение')
    .addComponents(
      createTextInputRow(FORM_IDS.promotionNickname, 'Ваш ник', TextInputStyle.Short, true, 100, 'Например: Гоша Килла'),
      createTextInputRow(FORM_IDS.promotionCid, 'Ваш CID', TextInputStyle.Short, true, 50, 'Например: 122'),
      createTextInputRow(FORM_IDS.promotionCurrentRank, 'Текущий ранг', TextInputStyle.Short, true, 80, 'Например: 2 | KILLA'),
      createTextInputRow(FORM_IDS.promotionTargetRank, 'Хочу на ранг', TextInputStyle.Short, true, 80, 'Например: 3 | OLD KILLA'),
      createTextInputRow(FORM_IDS.promotionReport, 'Отчёт / доказательства', TextInputStyle.Paragraph, true, 900, 'Дерево, дни активности, помощь, ссылки на скрины/видео'),
    );
}
