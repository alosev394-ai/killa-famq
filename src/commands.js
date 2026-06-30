import { ApplicationCommandOptionType, ChannelType, PermissionFlagsBits } from 'discord.js';
import { PRICE_CATEGORY_CHOICES } from './price-list.js';

export const COMMAND_GROUPS = [
  {
    name: 'Основное',
    commands: [
      ['помощь', 'показать все команды и подсказки'],
      ['правила', 'показать правила сервера'],
      ['сервер', 'показать краткую информацию о сервере'],
      ['опрос', 'создать опрос с реакциями'],
    ],
  },
  {
    name: 'Правила',
    commands: [
      ['правила-настроить установить', 'заменить весь список правил'],
      ['правила-настроить добавить', 'добавить новое правило'],
      ['правила-настроить очистить', 'очистить правила'],
    ],
  },
  {
    name: 'Модерация',
    commands: [
      ['очистить', 'удалить последние сообщения'],
      ['мут', 'выдать тайм-аут пользователю'],
      ['размут', 'снять тайм-аут'],
      ['кик', 'кикнуть пользователя'],
      ['бан', 'забанить пользователя'],
      ['разбан', 'снять бан по ID'],
      ['замедлить', 'изменить slowmode в канале'],
    ],
  },
  {
    name: 'Журнал',
    commands: [
      ['предупредить', 'выдать предупреждение'],
      ['предупреждения', 'посмотреть предупреждения пользователя'],
      ['снять-предупреждения', 'очистить предупреждения пользователя'],
      ['сказать', 'отправить обычное сообщение от имени бота'],
      ['объявление', 'отправить аккуратное объявление'],
    ],
  },
  {
    name: 'Розыгрыши',
    commands: [
      ['розыгрыш', 'создать розыгрыш с кнопкой участия'],
    ],
  },
  {
    name: 'Расценки',
    commands: [
      ['прайс', 'показать актуальные расценки'],
      ['прайс-настроить опубликовать', 'обновить главный пост с расценками'],
      ['прайс-настроить изменить', 'изменить цену ресурса'],
      ['прайс-настроить добавить', 'добавить новый ресурс в прайс'],
      ['прайс-настроить удалить', 'удалить ресурс из прайса'],
    ],
  },
];

/**
 * Converts a Discord permission bit into the string format expected by the API.
 * @param {bigint} permission - Discord permission bit.
 * @returns {string} Serialized permission bit.
 * @skill-verified
 */
function permissionValue(permission) {
  return permission.toString();
}

const COMMAND_DEFINITIONS = [
  {
    name: 'помощь',
    description: 'Показывает команды KILLA FAMQ и подсказки по админке.',
    dm_permission: false,
  },
  {
    name: 'правила',
    description: 'Показывает правила сервера.',
    dm_permission: false,
  },
  {
    name: 'сервер',
    description: 'Показывает краткую информацию о сервере.',
    dm_permission: false,
  },
  {
    name: 'правила-настроить',
    description: 'Настраивает правила сервера.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ManageGuild),
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'установить',
        description: 'Заменить весь список правил. Разделяй пункты переносами строк.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'текст',
            description: 'Новый список правил.',
            required: true,
            max_length: 4000,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'добавить',
        description: 'Добавить одно новое правило в конец списка.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'правило',
            description: 'Текст правила.',
            required: true,
            max_length: 1000,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'очистить',
        description: 'Удалить сохраненные правила.',
      },
    ],
  },
  {
    name: 'очистить',
    description: 'Удаляет последние сообщения в текущем канале.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ManageMessages),
    options: [
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'количество',
        description: 'Сколько сообщений удалить: от 1 до 100.',
        required: true,
        min_value: 1,
        max_value: 100,
      },
    ],
  },
  {
    name: 'мут',
    description: 'Выдает пользователю тайм-аут.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ModerateMembers),
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'пользователь',
        description: 'Кого отправить в тайм-аут.',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'минуты',
        description: 'Длительность тайм-аута: от 1 до 40320 минут.',
        required: true,
        min_value: 1,
        max_value: 40320,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'причина',
        description: 'Причина модерации.',
        required: false,
        max_length: 500,
      },
    ],
  },
  {
    name: 'размут',
    description: 'Снимает тайм-аут с пользователя.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ModerateMembers),
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'пользователь',
        description: 'С кого снять тайм-аут.',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'причина',
        description: 'Причина снятия тайм-аута.',
        required: false,
        max_length: 500,
      },
    ],
  },
  {
    name: 'кик',
    description: 'Кикает пользователя с сервера.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.KickMembers),
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'пользователь',
        description: 'Кого кикнуть.',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'причина',
        description: 'Причина кика.',
        required: false,
        max_length: 500,
      },
    ],
  },
  {
    name: 'бан',
    description: 'Банит пользователя.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.BanMembers),
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'пользователь',
        description: 'Кого забанить.',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'причина',
        description: 'Причина бана.',
        required: false,
        max_length: 500,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'удалить-дни',
        description: 'Удалить сообщения пользователя за 0-7 последних дней.',
        required: false,
        min_value: 0,
        max_value: 7,
      },
    ],
  },
  {
    name: 'разбан',
    description: 'Снимает бан по ID пользователя.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.BanMembers),
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'id',
        description: 'Discord ID пользователя.',
        required: true,
        min_length: 17,
        max_length: 20,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'причина',
        description: 'Причина разбана.',
        required: false,
        max_length: 500,
      },
    ],
  },
  {
    name: 'предупредить',
    description: 'Выдает предупреждение и сохраняет его в журнале.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ModerateMembers),
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'пользователь',
        description: 'Кому выдать предупреждение.',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'причина',
        description: 'За что выдается предупреждение.',
        required: true,
        max_length: 1000,
      },
    ],
  },
  {
    name: 'предупреждения',
    description: 'Показывает предупреждения пользователя.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ModerateMembers),
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'пользователь',
        description: 'Чьи предупреждения показать.',
        required: true,
      },
    ],
  },
  {
    name: 'снять-предупреждения',
    description: 'Очищает предупреждения пользователя.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ModerateMembers),
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'пользователь',
        description: 'Чьи предупреждения очистить.',
        required: true,
      },
    ],
  },
  {
    name: 'замедлить',
    description: 'Устанавливает slowmode в текущем канале.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ManageChannels),
    options: [
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'секунды',
        description: 'Задержка между сообщениями: 0-21600 секунд.',
        required: true,
        min_value: 0,
        max_value: 21600,
      },
    ],
  },
  {
    name: 'сказать',
    description: 'Отправляет обычное сообщение от имени бота.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ManageMessages),
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'текст',
        description: 'Что написать от имени бота.',
        required: true,
        max_length: 2000,
      },
      {
        type: ApplicationCommandOptionType.Channel,
        name: 'канал',
        description: 'Куда отправить сообщение. Если не выбрать, будет текущий канал.',
        required: false,
        channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      },
    ],
  },
  {
    name: 'объявление',
    description: 'Отправляет красивое объявление в канал.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ManageMessages),
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'текст',
        description: 'Текст объявления.',
        required: true,
        max_length: 4000,
      },
      {
        type: ApplicationCommandOptionType.Channel,
        name: 'канал',
        description: 'Куда отправить объявление. Если не выбрать, будет текущий канал.',
        required: false,
        channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      },
    ],
  },
  {
    name: 'опрос',
    description: 'Создает опрос с реакциями. Варианты разделяй точкой с запятой.',
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'вопрос',
        description: 'Вопрос для голосования.',
        required: true,
        max_length: 200,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'варианты',
        description: 'От 2 до 10 вариантов через ; например: да; нет; позже',
        required: true,
        max_length: 1000,
      },
      {
        type: ApplicationCommandOptionType.Channel,
        name: 'канал',
        description: 'Куда отправить опрос. Если не выбрать, будет текущий канал.',
        required: false,
        channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      },
    ],
  },
  {
    name: 'розыгрыш',
    description: 'Создает розыгрыш с кнопкой участия в giveaway-канале.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ManageGuild),
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'приз',
        description: 'Что разыгрывается.',
        required: true,
        max_length: 200,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'победителей',
        description: 'Сколько победителей выбрать.',
        required: true,
        min_value: 1,
        max_value: 20,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'часы',
        description: 'Через сколько часов завершить розыгрыш.',
        required: false,
        min_value: 0,
        max_value: 720,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'минуты',
        description: 'Через сколько минут завершить розыгрыш.',
        required: false,
        min_value: 0,
        max_value: 59,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'секунды',
        description: 'Через сколько секунд завершить розыгрыш.',
        required: false,
        min_value: 0,
        max_value: 59,
      },
      {
        type: ApplicationCommandOptionType.Channel,
        name: 'канал',
        description: 'Канал розыгрыша. Если не выбрать, бот найдет giveaway сам.',
        required: false,
        channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      },
    ],
  },
  {
    name: 'прайс',
    description: 'Показывает актуальные расценки ресурсов.',
    dm_permission: false,
  },
  {
    name: 'прайс-настроить',
    description: 'Управляет актуальными расценками ресурсов.',
    dm_permission: false,
    default_member_permissions: permissionValue(PermissionFlagsBits.ManageGuild),
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'опубликовать',
        description: 'Отправить или обновить главный пост с расценками.',
        options: [
          {
            type: ApplicationCommandOptionType.Channel,
            name: 'канал',
            description: 'Канал с расценками. Если не выбрать, бот найдет его сам.',
            required: false,
            channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'изменить',
        description: 'Изменить цену уже существующего ресурса.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'название',
            description: 'Название ресурса, например: Дерево.',
            required: true,
            max_length: 80,
          },
          {
            type: ApplicationCommandOptionType.String,
            name: 'цена',
            description: 'Новая цена, например: 2300.',
            required: true,
            max_length: 40,
          },
          {
            type: ApplicationCommandOptionType.String,
            name: 'эмодзи',
            description: 'Новый эмодзи для строки, если нужно.',
            required: false,
            max_length: 20,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'добавить',
        description: 'Добавить новый ресурс в прайс.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'категория',
            description: 'Раздел прайса.',
            required: true,
            choices: PRICE_CATEGORY_CHOICES,
          },
          {
            type: ApplicationCommandOptionType.String,
            name: 'название',
            description: 'Название ресурса.',
            required: true,
            max_length: 80,
          },
          {
            type: ApplicationCommandOptionType.String,
            name: 'цена',
            description: 'Цена ресурса.',
            required: true,
            max_length: 40,
          },
          {
            type: ApplicationCommandOptionType.String,
            name: 'эмодзи',
            description: 'Эмодзи для строки.',
            required: false,
            max_length: 20,
          },
          {
            type: ApplicationCommandOptionType.Boolean,
            name: 'деньги',
            description: 'Добавлять 💵 после цены. По умолчанию да.',
            required: false,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'удалить',
        description: 'Удалить ресурс из прайса.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'название',
            description: 'Название ресурса для удаления.',
            required: true,
            max_length: 80,
          },
        ],
      },
    ],
  },
];

/**
 * Returns fresh Discord application command payloads.
 * @returns {Array<Record<string, unknown>>} Slash command definitions ready for the Discord REST API.
 * @skill-verified
 */
export function buildCommands() {
  return structuredClone(COMMAND_DEFINITIONS);
}
