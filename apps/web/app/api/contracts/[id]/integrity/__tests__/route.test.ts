import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockValidateContractIntegrity, mockFormatIntegrityReport } = vi.hoisted(() => ({
  mockValidateContractIntegrity: vi.fn(),
  mockFormatIntegrityReport: vi.fn(),
}));

vi.mock('@/lib/validation/contract-integrity', () => ({
  validateContractIntegrity: mockValidateContractIntegrity,
  formatIntegrityReport: mockFormatIntegrityReport,
}));

import { GET } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(format?: 'json' | 'text', withAuth = true) {
  const suffix = format ? `?format=${format}` : '';
  return new NextRequest(`http://localhost:3000/api/contracts/contract-1/integrity${suffix}`, {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('/api/contracts/[id]/integrity', () => {
  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(undefined, false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.tenantId for the JSON integrity report', async () => {
    mockValidateContractIntegrity.mockResolvedValueOnce({
      valid: false,
      score: 72,
      issues: [
        { severity: 'error', category: 'dates', message: 'Bad date', field: 'effectiveDate', suggestedFix: 'Fix it' },
        { severity: 'warning', category: 'metadata', message: 'Missing metadata', field: 'category', suggestedFix: '' },
      ],
    });

    const response = await GET(createRequest('json'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockValidateContractIntegrity).toHaveBeenCalledWith('contract-1', 'tenant-1');
    expect(data.data.summary).toEqual({ errors: 1, warnings: 1, info: 0 });
  });

  it('returns text output when requested', async () => {
    mockValidateContractIntegrity.mockResolvedValueOnce({ valid: true, score: 100, issues: [] });
    mockFormatIntegrityReport.mockReturnValueOnce('Integrity report');

    const response = await GET(createRequest('text'), routeContext);
    const body = await new Response((response as Response).body).text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(body).toBe('Integrity report');
  });
});