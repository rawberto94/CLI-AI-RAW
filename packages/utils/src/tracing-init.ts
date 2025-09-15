import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';

let sdk: NodeSDK | null = null;

export function initTracing(serviceName: string) {
  if (sdk || String(process.env.TRACING_ENABLED || 'false').toLowerCase() !== 'true') return;

  const resource: Resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
  });

  sdk = new NodeSDK({
    resource,
    instrumentations: [getNodeAutoInstrumentations()]
  });

  try {
    sdk.start();
  } catch (err: unknown) {
    console.error('Tracing start failed', err);
  }

  process.on('exit', () => { sdk?.shutdown().catch(() => {}); });
}
