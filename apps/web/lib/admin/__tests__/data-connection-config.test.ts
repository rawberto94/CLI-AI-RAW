import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/integrations/connectors/encryption', () => ({
  encryptCredentials: vi.fn(),
  decryptCredentials: vi.fn(),
  isEncrypted: vi.fn(),
}));

import {
  decryptDataConnectionConfig,
  encryptDataConnectionConfig,
  sanitizeDataConnectionForClient,
} from '../data-connection-config';

import { encryptCredentials, decryptCredentials, isEncrypted } from '@/lib/integrations/connectors/encryption';

beforeEach(() => {
  vi.mocked(encryptCredentials).mockImplementation((data: any) => ({
    encrypted: JSON.stringify(data),
    iv: 'iv',
    authTag: 'tag',
    version: 1,
  }));
  vi.mocked(decryptCredentials).mockImplementation((data: any) => JSON.parse(data.encrypted));
  vi.mocked(isEncrypted).mockImplementation((data: any) =>
    Boolean(data && typeof data === 'object' && 'encrypted' in data && 'iv' in data && 'authTag' in data && 'version' in data)
  );
});

describe('data connection config helpers', () => {
  it('round-trips encrypted configs through the connector encryption helper', () => {
    const input = { host: 'db.local', username: 'alice', password: 'secret' };

    const encrypted = encryptDataConnectionConfig(input);
    const decrypted = decryptDataConnectionConfig<typeof input>(encrypted);

    expect(decrypted).toEqual(input);
  });

  it('supports legacy base64-encoded JSON configs', () => {
    const legacy = Buffer.from(JSON.stringify({ host: 'legacy.local', password: 'old-secret' }), 'utf8').toString('base64');

    expect(decryptDataConnectionConfig<{ host: string; password: string }>(legacy)).toEqual({
      host: 'legacy.local',
      password: 'old-secret',
    });
  });

  it('removes encryptedConfig from client responses', () => {
    expect(
      sanitizeDataConnectionForClient({ id: 'conn-1', name: 'Primary', encryptedConfig: { encrypted: 'x' } }),
    ).toEqual({ id: 'conn-1', name: 'Primary' });
  });
});