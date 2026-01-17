/**
 * Telemetry Index
 * 
 * Re-exports all telemetry utilities for easy importing.
 */

export { initTelemetry } from './opentelemetry';
export {
  startSpan,
  withSpan,
  addTenantContext,
  addContractContext,
  recordEvent,
  traceDbOperation,
  traceAIOperation,
  traceExternalCall,
  getTraceHeaders,
  extractTraceContext,
} from './tracing';
