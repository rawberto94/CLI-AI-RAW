import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { logger } from './logging';

export const initTelemetry = (serviceName: string) => {
  const traceExporter = new OTLPTraceExporter({
    // optional - default url is http://localhost:4318/v1/traces
    // url: '<your-otlp-endpoint>/v1/traces',
    // optional - collection of custom headers to be sent with each request, empty by default
    headers: {},
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  logger.info(`Telemetry initialized for ${serviceName}`);

  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => logger.info('Tracing terminated'))
      .catch((error) => logger.error('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
};