import { describe, expect, it, vi } from 'vitest';
import RateCardCreateRedirectPage from '../page';

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

describe('RateCardCreateRedirectPage', () => {
  it('redirects to the canonical new rate card route', () => {
    RateCardCreateRedirectPage();

    expect(mockRedirect).toHaveBeenCalledWith('/rate-cards/new');
  });
});