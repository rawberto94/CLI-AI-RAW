import { describe, expect, it } from 'vitest';

import {
  getQueuedDeliveryWhere,
  getRetryingDeliveryWhere,
  toDisplayDeliveryStatus,
} from '../status';

describe('webhook delivery status helpers', () => {
  it('classifies first-attempt pending deliveries as pending', () => {
    expect(
      toDisplayDeliveryStatus({
        status: 'pending',
        attempt: 0,
        error: null,
      }),
    ).toBe('pending');
  });

  it('classifies retrying pending deliveries as failed', () => {
    expect(
      toDisplayDeliveryStatus({
        status: 'pending',
        attempt: 3,
        error: 'HTTP 503',
      }),
    ).toBe('failed');
  });

  it('preserves stored success, dead, and legacy failed statuses', () => {
    expect(
      toDisplayDeliveryStatus({
        status: 'success',
        attempt: 1,
        error: null,
      }),
    ).toBe('success');

    expect(
      toDisplayDeliveryStatus({
        status: 'dead',
        attempt: 8,
        error: 'HTTP 500',
      }),
    ).toBe('dead');

    expect(
      toDisplayDeliveryStatus({
        status: 'failed',
        attempt: 2,
        error: 'Legacy failed row',
      }),
    ).toBe('failed');
  });

  it('builds retrying and queued Prisma filters consistently', () => {
    expect(getRetryingDeliveryWhere()).toEqual({
      status: 'pending',
      attempt: { gt: 0 },
      error: { not: null },
    });

    expect(getQueuedDeliveryWhere()).toEqual({
      status: 'pending',
      NOT: {
        attempt: { gt: 0 },
        error: { not: null },
      },
    });
  });
});
