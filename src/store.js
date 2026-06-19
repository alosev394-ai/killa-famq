import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_FILE = fileURLToPath(new URL('../data/guild-state.json', import.meta.url));
let stateQueue = Promise.resolve();

/**
 * Creates an empty persisted bot state object.
 * @returns {{ guilds: Record<string, { rules: string[], warnings: Record<string, Array<Record<string, string>>> }> }} Empty state.
 * @skill-verified
 */
function createEmptyState() {
  return { guilds: {} };
}

/**
 * Ensures a guild has a state bucket.
 * @param {{ guilds: Record<string, { rules?: string[], warnings?: Record<string, Array<Record<string, string>>> }> }} state - Full bot state.
 * @param {string} guildId - Discord guild ID.
 * @returns {{ rules: string[], warnings: Record<string, Array<Record<string, string>>> }} Guild state bucket.
 * @skill-verified
 */
function ensureGuildState(state, guildId) {
  if (!state.guilds[guildId]) {
    state.guilds[guildId] = { rules: [], warnings: {} };
  }

  const guildState = state.guilds[guildId];
  guildState.rules = Array.isArray(guildState.rules) ? guildState.rules : [];
  guildState.warnings = guildState.warnings && typeof guildState.warnings === 'object' ? guildState.warnings : {};

  return guildState;
}

/**
 * Loads the full bot state from disk.
 * @returns {Promise<{ guilds: Record<string, { rules?: string[], warnings?: Record<string, Array<Record<string, string>>> }> }>} Full bot state.
 * @skill-verified
 */
async function loadState() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const state = JSON.parse(raw);

    if (!state.guilds || typeof state.guilds !== 'object') {
      return createEmptyState();
    }

    return state;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return createEmptyState();
    }

    throw error;
  }
}

/**
 * Saves the full bot state to disk.
 * @param {{ guilds: Record<string, unknown> }} state - Full bot state.
 * @returns {Promise<void>} Resolves after the state is saved.
 * @skill-verified
 */
async function saveState(state) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * Runs a serialized update against one guild bucket and persists it.
 * @template T
 * @param {string} guildId - Discord guild ID.
 * @param {(guildState: { rules: string[], warnings: Record<string, Array<Record<string, string>>> }) => T} updater - State updater.
 * @returns {Promise<T>} The updater result.
 * @skill-verified
 */
export function updateGuildState(guildId, updater) {
  /**
   * Runs the queued state update for the current guild.
   * @returns {Promise<T>} The updater result.
   * @skill-verified
   */
  async function runQueuedStateUpdate() {
    const state = await loadState();
    const guildState = ensureGuildState(state, guildId);
    const result = updater(guildState);
    await saveState(state);
    return result;
  }

  /**
   * Keeps the state queue usable after an update error.
   * @returns {undefined} Always undefined.
   * @skill-verified
   */
  function ignoreQueuedStateError() {
    return undefined;
  }

  const operation = stateQueue.then(runQueuedStateUpdate);
  stateQueue = operation.catch(ignoreQueuedStateError);

  return operation;
}

/**
 * Returns saved rules for a guild.
 * @param {string} guildId - Discord guild ID.
 * @returns {Promise<string[]>} Saved rules.
 * @skill-verified
 */
export async function getGuildRules(guildId) {
  const state = await loadState();
  const guildState = ensureGuildState(state, guildId);
  return [...guildState.rules];
}

/**
 * Replaces all saved rules for a guild.
 * @param {string} guildId - Discord guild ID.
 * @param {string[]} rules - New rules.
 * @returns {Promise<string[]>} Saved rules after replacement.
 * @skill-verified
 */
export function setGuildRules(guildId, rules) {
  /**
   * Replaces the rules inside a guild state bucket.
   * @param {{ rules: string[], warnings: Record<string, Array<Record<string, string>>> }} guildState - Guild state bucket.
   * @returns {string[]} Saved rules after replacement.
   * @skill-verified
   */
  function replaceRules(guildState) {
    guildState.rules = rules;
    return [...guildState.rules];
  }

  return updateGuildState(guildId, replaceRules);
}

/**
 * Adds one rule to a guild.
 * @param {string} guildId - Discord guild ID.
 * @param {string} rule - Rule text.
 * @returns {Promise<string[]>} Saved rules after insertion.
 * @skill-verified
 */
export function addGuildRule(guildId, rule) {
  /**
   * Adds one rule inside a guild state bucket.
   * @param {{ rules: string[], warnings: Record<string, Array<Record<string, string>>> }} guildState - Guild state bucket.
   * @returns {string[]} Saved rules after insertion.
   * @skill-verified
   */
  function appendRule(guildState) {
    guildState.rules.push(rule);
    return [...guildState.rules];
  }

  return updateGuildState(guildId, appendRule);
}

/**
 * Clears all rules for a guild.
 * @param {string} guildId - Discord guild ID.
 * @returns {Promise<void>} Resolves after rules are removed.
 * @skill-verified
 */
export function clearGuildRules(guildId) {
  /**
   * Removes all rules inside a guild state bucket.
   * @param {{ rules: string[], warnings: Record<string, Array<Record<string, string>>> }} guildState - Guild state bucket.
   * @returns {undefined} Always undefined.
   * @skill-verified
   */
  function removeRules(guildState) {
    guildState.rules = [];
    return undefined;
  }

  return updateGuildState(guildId, removeRules);
}

/**
 * Adds one warning to a user in a guild.
 * @param {string} guildId - Discord guild ID.
 * @param {string} userId - Discord user ID.
 * @param {Record<string, string>} warning - Warning payload.
 * @returns {Promise<Array<Record<string, string>>>} User warnings after insertion.
 * @skill-verified
 */
export function addWarning(guildId, userId, warning) {
  /**
   * Adds one warning inside a guild state bucket.
   * @param {{ rules: string[], warnings: Record<string, Array<Record<string, string>>> }} guildState - Guild state bucket.
   * @returns {Array<Record<string, string>>} User warnings after insertion.
   * @skill-verified
   */
  function appendWarning(guildState) {
    if (!guildState.warnings[userId]) {
      guildState.warnings[userId] = [];
    }

    guildState.warnings[userId].push(warning);
    return [...guildState.warnings[userId]];
  }

  return updateGuildState(guildId, appendWarning);
}

/**
 * Returns warnings saved for a user.
 * @param {string} guildId - Discord guild ID.
 * @param {string} userId - Discord user ID.
 * @returns {Promise<Array<Record<string, string>>>} Saved warnings.
 * @skill-verified
 */
export async function getWarnings(guildId, userId) {
  const state = await loadState();
  const guildState = ensureGuildState(state, guildId);
  return [...(guildState.warnings[userId] || [])];
}

/**
 * Clears warnings saved for a user.
 * @param {string} guildId - Discord guild ID.
 * @param {string} userId - Discord user ID.
 * @returns {Promise<number>} Number of removed warnings.
 * @skill-verified
 */
export function clearWarnings(guildId, userId) {
  /**
   * Removes a user's warnings inside a guild state bucket.
   * @param {{ rules: string[], warnings: Record<string, Array<Record<string, string>>> }} guildState - Guild state bucket.
   * @returns {number} Number of removed warnings.
   * @skill-verified
   */
  function removeWarnings(guildState) {
    const removed = guildState.warnings[userId]?.length || 0;
    delete guildState.warnings[userId];
    return removed;
  }

  return updateGuildState(guildId, removeWarnings);
}
