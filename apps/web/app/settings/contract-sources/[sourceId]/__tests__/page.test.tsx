import { describe, expect, it, vi } from 'vitest';
import LegacyContractSourceDetailsPage from '../page';

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

describe('LegacyContractSourceDetailsPage', () => {
  it('redirects legacy source detail links to the contract sources page', async () => {
    await LegacyContractSourceDetailsPage({
      params: Promise.resolve({ sourceId: 'source-1' }),
    });

    expect(mockRedirect).toHaveBeenCalledWith('/settings/contract-sources?sourceId=source-1');
  });
});