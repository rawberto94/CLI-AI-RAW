/**
 * OpenTelemetry Configuration
 * 
 * Distributed tracing for production observability.
 * Traces requests across services and provides insights into performance.
 * 
 * All heavy @opentelemetry/* imports are done dynamically so webpack
 * doesn't try to resolve the full dependency tree in dev mode
 * (avoids the `@opentelemetry/otlp-exporter-base/node-http` build error).
 */

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
 * Returns null in development unless OTEL_ENABLED=true.
 */
export async function initTelemetry(): Promise<any | null> {
  // Skip in development unless explicitly enabled
  if (ENVIRONMENT === 'development' && process.env.OTEL_ENABLED !== 'true') {
    console.log('OpenTelemetry disabled in development. Set OTEL_ENABLED=true to enable.');
    return null;
  }

  // Dynamic imports — only resolved when OTEL is actually enabled
  const [
    { NodeSDK },
    { getNodeAutoInstrumentations },
    { OTLPTraceExporter },
    { OTLPMetricExporter },
    { PeriodicExportingMetricReader },
    { Resource },
    semanticConventions,
  ] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/auto-instrumentations-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/exporter-metrics-otlp-http'),
    import('@opentelemetry/sdk-metrics'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/semantic-conventions'),
  ]);

  const {
    SEMRESATTRS_SERVICE_NAME,
    SEMRESATTRS_SERVICE_VERSION,
    SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  } = semanticConventions;

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

  // NOTE: Do NOT register process.on('SIGTERM') here.
  // Shutdown is managed by instrumentation.ts's graceful shutdown handler
  // which calls sdk.shutdown() before process.exit().

  console.log(`OpenTelemetry initialized for ${SERVICE_NAME} (${ENVIRONMENT})`);
  return sdk;
}

// Export for manual instrumentation
export { trace, context, SpanStatusCode } from '@opentelemetry/api';
export type { Span } from '@opentelemetry/api';
