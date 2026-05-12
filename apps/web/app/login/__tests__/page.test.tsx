import { describe, expect, it, vi } from 'vitest';
import LegacyLoginPage from '../page';

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

describe('LegacyLoginPage', () => {
  it('redirects to auth signin and preserves search params', async () => {
    await LegacyLoginPage({
      searchParams: Promise.resolve({
        error: 'session_expired',
        redirect: '/integrations',
      }),
    });

    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin?error=session_expired&redirect=%2Fintegrations');
  });
});