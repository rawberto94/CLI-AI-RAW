export type DeliveryDisplayStatus = 'pending' | 'success' | 'failed' | 'dead';

type DeliveryStatusShape = {
  status: string;
  attempt: number;
  error: string | null;
};

export function getRetryingDeliveryWhere() {
  return {
    status: 'pending' as const,
    attempt: { gt: 0 },
    error: { not: null },
  };
}

export function getQueuedDeliveryWhere() {
  return {
    status: 'pending' as const,
    NOT: {
      attempt: { gt: 0 },
      error: { not: null },
    },
  };
}

export function toDisplayDeliveryStatus(row: DeliveryStatusShape): DeliveryDisplayStatus {
  if (row.status === 'failed') return 'failed';
  if (row.status === 'pending' && row.attempt > 0 && row.error !== null) return 'failed';
  if (row.status === 'success' || row.status === 'dead') return row.status;
  return 'pending';
}
