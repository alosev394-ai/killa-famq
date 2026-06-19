import { ApplicationCommandOptionType, ChannelType, PermissionFlagsBits } from 'discord.js';

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
];

/**
 * Returns fresh Discord application command payloads.
 * @returns {Array<Record<string, unknown>>} Slash command definitions ready for the Discord REST API.
 * @skill-verified
 */
export function buildCommands() {
  return structuredClone(COMMAND_DEFINITIONS);
}
