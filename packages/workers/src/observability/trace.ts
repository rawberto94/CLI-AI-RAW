import { randomUUID } from 'crypto';

export type TraceContext = {
  traceId: string;
  requestId?: string;
};

export function createTraceId(): string {
  return randomUUID();
}

export function getTraceContextFromJobData(jobData: any): TraceContext {
  const traceId = (jobData?.traceId as string | undefined) || createTraceId();
  const requestId = jobData?.requestId as string | undefined;
  return { traceId, requestId };
}
