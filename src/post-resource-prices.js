import { Client, Events, GatewayIntentBits } from 'discord.js';
import { getRuntimeConfig } from './config.js';
import { publishGuildPriceList } from './price-list.js';

/**
 * Sends or updates resource prices in the configured server.
 * @param {import('discord.js').Client<true>} client - Ready Discord client.
 * @param {{ guildId: string | undefined }} config - Runtime config.
 * @returns {Promise<void>} Resolves after prices are sent or updated.
 * @skill-verified
 */
async function postResourcePrices(client, config) {
  if (!config.guildId) {
    throw new Error('DISCORD_GUILD_ID is required to post resource prices.');
  }

  const guild = await client.guilds.fetch(config.guildId);
  const result = await publishGuildPriceList(guild);
  console.log(`Расценки обновлены в канале #${result.channel.name}: ${result.message.url}`);
}

/**
 * Starts a one-time Discord client and posts resource prices after login.
 * @returns {Promise<void>} Resolves after the one-time client finishes.
 * @skill-verified
 */
async function run() {
  const config = getRuntimeConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  /**
   * Posts prices after the one-time client becomes ready.
   * @param {import('discord.js').Client<true>} readyClient - Ready Discord client.
   * @returns {Promise<void>} Resolves after prices are posted and the client is destroyed.
   * @skill-verified
   */
  client.once(Events.ClientReady, async function handleReady(readyClient) {
    try {
      await postResourcePrices(readyClient, config);
    } finally {
      readyClient.destroy();
    }
  });

  await client.login(config.token);
}

await run();
