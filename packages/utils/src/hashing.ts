import crypto from 'crypto';

// Compute a stable SHA-256 hex digest for strings or Buffers
export const hash = (data: string | Buffer): string => {
    return crypto.createHash('sha256').update(data).digest('hex');
};
