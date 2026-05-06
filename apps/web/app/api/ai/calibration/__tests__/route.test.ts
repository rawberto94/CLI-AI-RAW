import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockRecordBatchPredictions,
  mockRecalculateCalibration,
  mockRecordPrediction,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-ai-calibration',
    tenantId: 'tenant-1' as string | undefined,
    userId: 'user-1',
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockRecordBatchPredictions: vi.fn(),
  mockRecalculateCalibration: vi.fn(),
  mockRecordPrediction: vi.fn(),
}));

vi.mock('@/lib/api-middleware', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-middleware')>('@/lib/api-middleware');

  return {
    ...actual,
    withAuthApiHandler: (handler: (request: NextRequest, context: any) => Promise<Response>) => {
      return (request: NextRequest) => handler(request, mockCtx);
    },
  };
});

vi.mock('data-orchestration/services', () => ({
  confidenceCalibrationService: {
    recordBatchPredictions: mockRecordBatchPredictions,
    recalculateCalibration: mockRecalculateCalibration,
    recordPrediction: mockRecordPrediction,
  },
}));

import { POST } from '../route';

describe('/api/ai/calibration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.tenantId = 'tenant-1';
  });

  it('returns 400 when tenantId is missing', async () => {
    mockCtx.tenantId = undefined;

    const response = await POST(
      new NextRequest('http://localhost:3000/api/ai/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate', artifactType: 'RISK' }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
    expect(mockRecalculateCalibration).not.toHaveBeenCalled();
  });

  it('stamps batch predictions with the authenticated tenant', async () => {
    mockRecordBatchPredictions.mockResolvedValue(undefined);

    const response = await POST(
      new NextRequest('http://localhost:3000/api/ai/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-batch',
          predictions: [
            { artifactType: 'RISK', tenantId: 'forged-a', predictedConfidence: 0.8, wasCorrect: true },
            { artifactType: 'CLAUSES', tenantId: 'forged-b', predictedConfidence: 0.6, wasCorrect: false },
          ],
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRecordBatchPredictions).toHaveBeenCalledWith([
      { artifactType: 'RISK', tenantId: 'tenant-1', predictedConfidence: 0.8, wasCorrect: true },
      { artifactType: 'CLAUSES', tenantId: 'tenant-1', predictedConfidence: 0.6, wasCorrect: false },
    ]);
  });
});