import { test, expect } from '@playwright/test';

test.describe('API', () => {
  test('should be able to upload a file', async ({ request }) => {
    const response = await request.post('http://localhost:3001/uploads', {
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\n% minimal test pdf'),
        },
      },
    });
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json).toHaveProperty('docId');
  });
});
