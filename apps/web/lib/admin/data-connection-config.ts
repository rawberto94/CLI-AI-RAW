import {
  decryptCredentials,
  encryptCredentials,
  isEncrypted,
  type EncryptedData,
} from '@/lib/integrations/connectors/encryption';

export type StoredDataConnectionConfig = EncryptedData | string | Record<string, unknown> | null | undefined;

export function encryptDataConnectionConfig(config: Record<string, unknown>): EncryptedData {
  return encryptCredentials(config);
}

export function decryptDataConnectionConfig<T extends Record<string, unknown> = Record<string, unknown>>(
  storedConfig: StoredDataConnectionConfig,
): T {
  if (!storedConfig) {
    return {} as T;
  }

  if (isEncrypted(storedConfig)) {
    return decryptCredentials<T>(storedConfig);
  }

  if (typeof storedConfig === 'string') {
    try {
      const parsed = JSON.parse(storedConfig);
      if (isEncrypted(parsed)) {
        return decryptCredentials<T>(parsed);
      }
    } catch {
      // Not JSON-wrapped encrypted data; continue with legacy fallback.
    }

    try {
      return JSON.parse(Buffer.from(storedConfig, 'base64').toString('utf8')) as T;
    } catch {
      throw new Error('Failed to decode stored connection configuration');
    }
  }

  if (typeof storedConfig === 'object') {
    return storedConfig as T;
  }

  throw new Error('Unsupported stored connection configuration format');
}

export function sanitizeDataConnectionForClient<T extends { encryptedConfig?: unknown }>(
  connection: T,
): Omit<T, 'encryptedConfig'> {
  const { encryptedConfig: _encryptedConfig, ...sanitized } = connection;
  return sanitized;
}