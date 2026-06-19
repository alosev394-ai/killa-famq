import { REST, Routes } from 'discord.js';
import { buildCommands } from './commands.js';
import { getRuntimeConfig } from './config.js';

/**
 * Registers all slash commands with Discord.
 * @returns {Promise<void>} Resolves after Discord accepts the command payloads.
 * @skill-verified
 */
async function deployCommands() {
  const config = getRuntimeConfig();
  const commands = buildCommands();
  const rest = new REST({ version: '10' }).setToken(config.token);
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  console.log(`KILLA FAMQ: регистрирую ${commands.length} slash-команд...`);
  await rest.put(route, { body: commands });
  console.log(config.guildId ? 'Готово: команды обновлены на тестовом сервере.' : 'Готово: глобальные команды обновлены.');
}

await deployCommands();
