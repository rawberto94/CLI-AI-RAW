/**
 * OpenTelemetry Configuration
 * 
 * Distributed tracing for production observability.
 * Traces requests across services and provides insights into performance.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { 
  SEMRESATTRS_SERVICE_NAME, 
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT 
} from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Enable debug logging in development
if (process.env.OTEL_DEBUG === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'contigo-web';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

/**
 * Initialize OpenTelemetry SDK
 */
export function initTelemetry(): NodeSDK | null {
  // Skip in development unless explicitly enabled
  if (ENVIRONMENT === 'development' && process.env.OTEL_ENABLED !== 'true') {
    console.log('OpenTelemetry disabled in development. Set OTEL_ENABLED=true to enable.');
    return null;
  }

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
    [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
    'service.instance.id': process.env.HOSTNAME || 'unknown',
    'tenant.isolation': 'true',
  });

  // Trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: `${OTEL_ENDPOINT}/v1/traces`,
    headers: {
      'Authorization': process.env.OTEL_AUTH_HEADER || '',
    },
  });

  // Metric exporter
  const metricExporter = new OTLPMetricExporter({
    url: `${OTEL_ENDPOINT}/v1/metrics`,
    headers: {
      'Authorization': process.env.OTEL_AUTH_HEADER || '',
    },
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000, // Export every minute
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: metricReader as any,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Instrument HTTP requests
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        // Instrument Prisma
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
        // Instrument Redis
        '@opentelemetry/instrumentation-redis-4': {
          enabled: true,
        },
        // Disable noisy instrumentations
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
      }),
    ],
  });

  // Start the SDK
  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('OpenTelemetry shut down successfully'))
      .catch((error) => console.error('Error shutting down OpenTelemetry', error))
      .finally(() => process.exit(0));
  });

  console.log(`OpenTelemetry initialized for ${SERVICE_NAME} (${ENVIRONMENT})`);
  return sdk;
}

// Export for manual instrumentation
export { trace, context, SpanStatusCode } from '@opentelemetry/api';
export type { Span } from '@opentelemetry/api';
