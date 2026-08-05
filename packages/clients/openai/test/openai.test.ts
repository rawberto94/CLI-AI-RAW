import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  OpenAIClient,
  getActiveProviderConfig,
  hasAIClientConfig,
  getDeploymentName,
  tryCreateOpenAIClient,
} from '../index';

const saved = { ...process.env };

describe('clients-openai factory', () => {
  beforeEach(() => {
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_MINI_DEPLOYMENT;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('exports OpenAIClient', () => {
    expect(OpenAIClient).toBeDefined();
  });

  it('detects Azure when endpoint + key are set', () => {
    process.env.AZURE_OPENAI_API_KEY = 'azure-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com/';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o';
    process.env.AZURE_OPENAI_MINI_DEPLOYMENT = 'gpt-4o-mini';

    expect(hasAIClientConfig()).toBe(true);
    const cfg = getActiveProviderConfig();
    expect(cfg?.provider).toBe('azure');
    expect(getDeploymentName(false)).toBe('gpt-4o');
    expect(getDeploymentName(true)).toBe('gpt-4o-mini');
  });

  it('falls back to OpenAI key', () => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    expect(hasAIClientConfig()).toBe(true);
    expect(getActiveProviderConfig()?.provider).toBe('openai');
  });

  it('ignores placeholder OpenAI keys', () => {
    process.env.OPENAI_API_KEY = 'sk-your-key-here';
    expect(hasAIClientConfig()).toBe(false);
  });

  it('tryCreate returns null when unconfigured', () => {
    expect(tryCreateOpenAIClient()).toBeNull();
  });

  it('prefers Azure over OpenAI when both set', () => {
    process.env.AZURE_OPENAI_API_KEY = 'azure-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o';
    process.env.OPENAI_API_KEY = 'sk-also-set';
    expect(getActiveProviderConfig()?.provider).toBe('azure');
  });

  it('aliases mini deployment to main when mini unset', () => {
    process.env.AZURE_OPENAI_API_KEY = 'azure-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o';
    expect(getDeploymentName(true)).toBe('gpt-4o');
  });
});
