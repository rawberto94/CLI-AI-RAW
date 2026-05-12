import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicAppUrl } from '../public-app-url';

describe('getPublicAppUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers NEXT_PUBLIC_APP_URL when present', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com/');
    vi.stubEnv('NEXTAUTH_URL', 'https://auth.example.com');

    expect(getPublicAppUrl()).toBe('https://app.example.com');
  });

  it('falls back to NEXTAUTH_URL when the public app url is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NEXTAUTH_URL', 'https://auth.example.com/');

    expect(getPublicAppUrl()).toBe('https://auth.example.com');
  });

  it('falls back to localhost when no public app url is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NEXTAUTH_URL', '');

    expect(getPublicAppUrl()).toBe('http://localhost:3000');
  });
});