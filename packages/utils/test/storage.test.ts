import { describe, expect, it } from 'vitest';
import { resolveLocalStoragePath } from '../src/storage';

describe('resolveLocalStoragePath', () => {
  it('uses LOCAL_STORAGE_ROOT when set', () => {
    const original = process.env.LOCAL_STORAGE_ROOT;
    process.env.LOCAL_STORAGE_ROOT = '/app/uploads';
    try {
      expect(resolveLocalStoragePath('contracts/tenant/file.pdf')).toBe('/app/uploads/contracts/tenant/file.pdf');
    } finally {
      process.env.LOCAL_STORAGE_ROOT = original;
    }
  });

  it('falls back to process.cwd()/uploads when LOCAL_STORAGE_ROOT is not set', () => {
    const original = process.env.LOCAL_STORAGE_ROOT;
    delete process.env.LOCAL_STORAGE_ROOT;
    try {
      expect(resolveLocalStoragePath('contracts/tenant/file.pdf')).toMatch(/uploads\/contracts\/tenant\/file\.pdf$/);
    } finally {
      process.env.LOCAL_STORAGE_ROOT = original;
    }
  });
});
