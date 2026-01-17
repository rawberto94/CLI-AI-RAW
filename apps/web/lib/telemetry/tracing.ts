/**
 * Tracing Utilities
 * 
 * Helper functions for manual span creation and context propagation.
 */

import { trace, context, SpanStatusCode, Span, SpanKind, Attributes } from '@opentelemetry/api';

const tracer = trace.getTracer('contigo-app', '1.0.0');

/**
 * Create a new span for tracing an operation
 */
export function startSpan(
  name: string,
  attributes?: Attributes,
  kind: SpanKind = SpanKind.INTERNAL
): Span {
  return tracer.startSpan(name, {
    kind,
    attributes,
  });
}

/**
 * Wrap an async function with tracing
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const span = startSpan(name, attributes);
  
  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add tenant context to the current span
 */
export function addTenantContext(tenantId: string, userId?: string): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('tenant.id', tenantId);
    if (userId) {
      span.setAttribute('user.id', userId);
    }
  }
}

/**
 * Add contract context to the current span
 */
export function addContractContext(contractId: string, operation: string): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('contract.id', contractId);
    span.setAttribute('contract.operation', operation);
  }
}

/**
 * Record a custom event in the current span
 */
export function recordEvent(name: string, attributes?: Attributes): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Trace a database operation
 */
export async function traceDbOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `db.${operation}`,
    async (span) => {
      span.setAttribute('db.system', 'postgresql');
      span.setAttribute('db.operation', operation);
      span.setAttribute('db.table', table);
      return fn();
    },
    { 'db.type': 'sql' }
  );
}

/**
 * Trace an AI/LLM operation
 */
export async function traceAIOperation<T>(
  model: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `ai.${operation}`,
    async (span) => {
      span.setAttribute('ai.model', model);
      span.setAttribute('ai.operation', operation);
      const startTokens = Date.now();
      const result = await fn();
      span.setAttribute('ai.duration_ms', Date.now() - startTokens);
      return result;
    },
    { 'ai.provider': 'openai' }
  );
}

/**
 * Trace an external API call
 */
export async function traceExternalCall<T>(
  service: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `external.${service}`,
    async (span) => {
      span.setAttribute('http.url', endpoint);
      span.setAttribute('external.service', service);
      return fn();
    },
    { kind: SpanKind.CLIENT }
  );
}

/**
 * Create trace context headers for propagation
 */
export function getTraceHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const span = trace.getActiveSpan();
  
  if (span) {
    const spanContext = span.spanContext();
    headers['traceparent'] = `00-${spanContext.traceId}-${spanContext.spanId}-01`;
  }
  
  return headers;
}

/**
 * Extract trace context from incoming request headers
 */
export function extractTraceContext(headers: Headers): void {
  const traceparent = headers.get('traceparent');
  if (traceparent) {
    // OpenTelemetry auto-instrumentation handles this
    // This is for manual context extraction if needed
  }
}
