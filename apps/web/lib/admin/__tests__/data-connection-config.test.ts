import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/integrations/connectors/encryption', () => ({
  encryptCredentials: vi.fn((data) => ({
    encrypted: JSON.stringify(data),
    iv: 'iv',
    authTag: 'tag',
    version: 1,
  })),
  decryptCredentials: vi.fn((data) => JSON.parse(data.encrypted)),
  isEncrypted: vi.fn((data) => Boolean(data && typeof data === 'object' && 'encrypted' in data && 'iv' in data && 'authTag' in data && 'version' in data)),
}));

import {
  decryptDataConnectionConfig,
  encryptDataConnectionConfig,
  sanitizeDataConnectionForClient,
} from '../data-connection-config';

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