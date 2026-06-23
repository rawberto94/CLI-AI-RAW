import 'dotenv/config';
import OpenAI, { AzureOpenAI } from 'openai';

function getActiveProviderConfig() {
  const azureApiKey = (process.env.AZURE_OPENAI_API_KEY || '').trim();
  const azureEndpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').trim();
  if (azureApiKey && azureEndpoint) {
    return {
      provider: 'azure' as const,
      apiKey: azureApiKey,
      endpoint: azureEndpoint.replace(/\/$/, ''),
      deployment: (process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o').trim(),
      apiVersion: (process.env.AZURE_OPENAI_API_VERSION || '2024-02-01').trim(),
    };
  }
  const openAiApiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (openAiApiKey) {
    return { provider: 'openai' as const, apiKey: openAiApiKey };
  }
  return null;
}

async function main() {
  const config = getActiveProviderConfig();
  if (!config) {
    throw new Error('No AI provider configured');
  }
  console.log('Provider:', config.provider);
  console.log('Key prefix:', config.apiKey.substring(0, 20) + '...');

  let openai: OpenAI;
  let model: string;
  if (config.provider === 'azure') {
    openai = new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      deployment: config.deployment,
      apiVersion: config.apiVersion,
      timeout: 60_000,
      maxRetries: 1,
    }) as unknown as OpenAI;
    model = config.deployment;
  } else {
    openai = new OpenAI({ apiKey: config.apiKey, timeout: 60_000, maxRetries: 1 });
    model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }
  console.log('Testing model:', model);

  const start = Date.now();
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: 'Say "AI connectivity OK" and nothing else.' }],
    max_tokens: 20,
  });
  console.log(`Response in ${Date.now() - start}ms:`, response.choices[0]?.message?.content);
}

main().catch((err) => {
  console.error('AI connectivity test failed:', err);
  process.exit(1);
});
