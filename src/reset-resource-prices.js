import { Client, Events, GatewayIntentBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';
import { createDefaultPriceList, publishGuildPriceList } from './price-list.js';
import { setGuildPriceList } from './store.js';

/**
 * Builds a fresh current price list marked as updated by the bot.
 * @param {string} updatedById - Discord user ID that should be shown as updater.
 * @returns {Record<string, unknown>} Current price list.
 * @skill-verified
 */
function buildCurrentPriceList(updatedById) {
  const priceList = createDefaultPriceList();
  priceList.updatedAt = new Date().toISOString();
  priceList.updatedById = updatedById;
  return priceList;
}

/**
 * Resets saved resource prices and updates the published Discord message.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after prices are reset and published.
 * @skill-verified
 */
async function resetResourcePrices(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to reset resource prices.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const priceList = buildCurrentPriceList(client.user.id);
  await setGuildPriceList(guild.id, priceList);
  const result = await publishGuildPriceList(guild, { priceList });
  console.log(`Расценки сброшены и обновлены в канале #${result.channel.name}: ${result.message.url}`);
}

/**
 * Starts a one-time Discord client and resets resource prices after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Resets prices after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after prices are reset and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await resetResourcePrices(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
