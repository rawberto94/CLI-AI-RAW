import { test, expect } from 'vitest';
import { uploadToS3, getSignedUrl } from '../index';

test('S3 client functions should be defined', () => {
    expect(uploadToS3).toBeDefined();
    expect(getSignedUrl).toBeDefined();
});
