/**
 * Shared OpenAI client for workers / agents.
 * Azure-first via clients-openai factory (agent-readiness P1-3).
 */

import {
  createOpenAIClient,
  createEmbeddingClient,
  tryCreateOpenAIClient,
  hasAIClientConfig,
  getDeploymentName,
  isAzureOpenAIEnabled,
} from 'clients-openai';

export {
  createOpenAIClient,
  createEmbeddingClient,
  tryCreateOpenAIClient,
  hasAIClientConfig,
  getDeploymentName,
  isAzureOpenAIEnabled,
};

/** Lazy chat client (throws if unconfigured — prefer tryCreate for optional agents). */
let _chat: ReturnType<typeof createOpenAIClient> | null = null;
export function getOpenAI() {
  if (!_chat) {
    _chat = createOpenAIClient();
  }
  return _chat;
}

/** Soft get — null when no Azure/OpenAI config (does not construct stock OpenAI with missing key). */
export function getOpenAIOrNull() {
  return tryCreateOpenAIClient();
}

// Backward-compatible default: only construct when configured
export const openai = new Proxy({} as any, {
  get(_target, prop) {
    const client = getOpenAI();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default openai;
