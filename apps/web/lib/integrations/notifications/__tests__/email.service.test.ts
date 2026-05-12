import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailNotificationService } from '../email.service';

describe('EmailNotificationService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the shared public app url for contract source links', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com/');
    vi.stubEnv('NEXTAUTH_URL', '');

    const service = new EmailNotificationService({
      provider: 'smtp',
      from: 'noreply@example.com',
    });

    const failureText = (service as any).generateFailureEmailText({
      source: {
        id: 'source-1',
        name: 'SharePoint Library',
        provider: 'sharepoint',
      },
      syncLog: {
        startedAt: new Date('2026-05-08T00:00:00.000Z'),
        filesProcessed: 3,
        errorMessage: 'Token expired',
      },
      retryCount: 1,
      maxRetries: 3,
    });

    const summaryText = (service as any).generateSummaryEmailText({
      tenantName: 'Acme Corp',
      period: 'daily',
      stats: {
        totalSyncs: 4,
        successful: 3,
        failed: 1,
        filesProcessed: 12,
        newContracts: 2,
        averageDuration: 120,
      },
      topSources: [],
      failedSources: [],
    });

    expect(failureText).toContain('https://app.example.com/settings/contract-sources?sourceId=source-1');
    expect(summaryText).toContain('https://app.example.com/settings/contract-sources');
  });
});