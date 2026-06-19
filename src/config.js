import 'dotenv/config';
import process from 'node:process';

/**
 * Reads a required environment variable and throws a helpful error if it is missing.
 * @param {string} name - Environment variable name.
 * @returns {string} The configured environment variable value.
 * @skill-verified
 */
export function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}. Проверь .env или .env.example.`);
  }

  return value;
}

/**
 * Reads an optional environment variable.
 * @param {string} name - Environment variable name.
 * @returns {string | undefined} The environment variable value, if present.
 * @skill-verified
 */
export function optionalEnv(name) {
  const value = process.env[name];
  return value || undefined;
}

/**
 * Builds the runtime configuration used by the bot and deployment script.
 * @returns {{ token: string, clientId: string, guildId: string | undefined }} Runtime configuration.
 * @skill-verified
 */
export function getRuntimeConfig() {
  return {
    token: requireEnv('DISCORD_TOKEN'),
    clientId: requireEnv('DISCORD_CLIENT_ID'),
    guildId: optionalEnv('DISCORD_GUILD_ID'),
  };
}
