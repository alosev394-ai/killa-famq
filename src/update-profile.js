import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';

const BOT_NAME = 'KILLA FAMQ';
const AVATAR_FILE = fileURLToPath(new URL('../assets/killa-famq-avatar.jpg', import.meta.url));

/**
 * Updates the bot username and avatar after Discord marks the client as ready.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @returns {Promise<void>} Resolves after the profile update finishes.
 * @skill-verified
 */
async function handleReady(client) {
  const avatar = await readFile(AVATAR_FILE);
  await client.user.setUsername(BOT_NAME);
  await client.user.setAvatar(avatar);
  console.log(`Профиль бота обновлен: ${BOT_NAME}.`);
  client.destroy();
}

/**
 * Logs in once and updates the bot profile.
 * @returns {Promise<void>} Resolves after the profile update is scheduled.
 * @skill-verified
 */
async function updateProfile() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, handleReady);
  await client.login(config.token);
}

await updateProfile();
