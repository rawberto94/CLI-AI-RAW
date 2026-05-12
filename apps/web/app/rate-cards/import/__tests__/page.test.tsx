import { describe, expect, it, vi } from 'vitest';
import RateCardImportRedirectPage from '../page';

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

describe('RateCardImportRedirectPage', () => {
  it('redirects to the canonical rate card upload route', () => {
    RateCardImportRedirectPage();

    expect(mockRedirect).toHaveBeenCalledWith('/rate-cards/upload');
  });
});