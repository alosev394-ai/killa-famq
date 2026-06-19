import { PermissionFlagsBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';

/**
 * Builds a Discord invite URL with bot and slash-command scopes.
 * @param {string} clientId - Discord application client ID.
 * @returns {string} Invite URL for the bot.
 * @skill-verified
 */
function buildInviteUrl(clientId) {
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: PermissionFlagsBits.Administrator.toString(),
    integration_type: '0',
    scope: 'bot applications.commands',
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Prints a Discord invite URL for the configured application.
 * @returns {void} Does not return a value.
 * @skill-verified
 */
function printInviteUrl() {
  const config = getRuntimeConfig();
  console.log(buildInviteUrl(config.clientId));
}

printInviteUrl();
