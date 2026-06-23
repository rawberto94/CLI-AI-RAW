import path from 'path';

/**
 * Resolve a stable relative storage key to the local filesystem path for the
 * current runtime (web container vs host worker).
 *
 * Upload paths are stored as relative keys such as `contracts/{tenantId}/{filename}`.
 * This avoids embedding container-absolute paths that host workers cannot reach.
 *
 * Resolution order:
 * 1. `LOCAL_STORAGE_ROOT` env var if set.
 * 2. Default to `{process.cwd()}/uploads` for web / general usage.
 * 3. Workers can override via `LOCAL_STORAGE_ROOT` to point at the web app's
 *    uploads directory (e.g. `/app/uploads` in the container or
 *    `../../apps/web/uploads` on a host PM2 worker).
 */
export function resolveLocalStoragePath(storagePath: string): string {
  const root = process.env.LOCAL_STORAGE_ROOT?.replace(/\/$/, '');
  if (root) {
    return path.join(root, storagePath);
  }
  return path.join(process.cwd(), 'uploads', storagePath);
}

/**
 * Convert an absolute local path back to the stable relative storage key.
 * This is the inverse of {@link resolveLocalStoragePath} and is used when
 * migrating existing absolute paths in the database.
 */
export function getLocalStorageKeyFromPath(absolutePath: string): string | null {
  const root = process.env.LOCAL_STORAGE_ROOT;
  const normalizedRoot = root ? path.normalize(root) : path.normalize(path.join(process.cwd(), 'uploads'));
  const normalizedPath = path.normalize(absolutePath);
  if (normalizedPath.startsWith(normalizedRoot + path.sep)) {
    return normalizedPath.slice(normalizedRoot.length + 1).replace(/\\/g, '/');
  }
  return null;
}
