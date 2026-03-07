/**
 * Storage Module Index
 * Re-exports all storage utilities for easy imports
 */

export * from './storage-factory';
export * from './delete';
export * from './cleanup-service';

// Convenience function for uploading to storage
import { getStorageProvider } from './storage-factory';

export async function uploadToStorage(
  path: string,
  content: Buffer,
  contentType?: string
): Promise<{ success: boolean; key: string; url?: string; error?: string }> {
  const provider = await getStorageProvider();
  return provider.upload({
    fileName: path,
    buffer: content,
    contentType,
  });
}

export async function downloadFromStorage(path: string): Promise<Buffer | null> {
  const provider = await getStorageProvider();
  return provider.download(path);
}

export async function getStorageUrl(path: string, expirySeconds?: number): Promise<string | null> {
  const provider = await getStorageProvider();
  return provider.getSignedUrl(path, expirySeconds);
}

export async function deleteFromStorage(path: string): Promise<boolean> {
  const provider = await getStorageProvider();
  return provider.delete(path);
}
