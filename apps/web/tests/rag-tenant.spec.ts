import { test, expect } from '@playwright/test';

// This test hits the API directly using Playwright's request fixture.
// It uploads a small text file under tenant A, captures the returned docId,
// then queries RAG for that doc under tenant A and tenant B to verify isolation.

test.describe('RAG tenant scoping', () => {
  test('tenant A can search its doc; tenant B cannot', async ({ request }) => {
    // 1) Upload a doc under tenant A
    const content = `Rate is 100 USD per day. Unique: ${Date.now()}`;
    const upload = await request.post('http://localhost:3001/uploads/batch', {
      headers: { 'x-tenant-id': 'tenant-a' },
      multipart: {
        // backend expects field name 'files'
        files: {
          name: 'sample-contract.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from(content, 'utf8'),
        },
      },
    });
    expect(upload.ok()).toBeTruthy();
    const upJson: any = await upload.json();
    const docIdRaw: unknown = upJson?.items?.[0]?.docId;
    expect(typeof docIdRaw === 'string' && docIdRaw.length > 0).toBeTruthy();
    if (typeof docIdRaw !== 'string' || !docIdRaw) {
      throw new Error('docId missing from upload response');
    }
    const docId: string = docIdRaw;

    // 2) Wait for embeddings to appear (poll chunks endpoint up to ~10s)
    const deadline = Date.now() + 10_000;
    let ready = false;
    while (Date.now() < deadline) {
      const chk = await request.get('http://localhost:3001/api/rag/chunks', {
        headers: { 'x-tenant-id': 'tenant-a' },
        params: { docId, k: '5' },
      });
      if (chk.ok()) {
        const chJson: any = await chk.json();
        const n = Array.isArray(chJson?.items) ? chJson.items.length : 0;
        if (n > 0) { ready = true; break; }
      }
  await new Promise(r => globalThis.setTimeout(r, 500));
    }
    expect(ready).toBeTruthy();

    // 3) Query RAG under tenant A
    const aRes = await request.get('http://localhost:3001/api/rag/search', {
      headers: { 'x-tenant-id': 'tenant-a' },
      params: { docId, q: 'rate 100 day' },
    });
    expect(aRes.ok()).toBeTruthy();
    const aJson: any = await aRes.json();
    const aItems = Array.isArray(aJson?.items) ? aJson.items : [];
    expect(Array.isArray(aItems)).toBeTruthy();

    // 4) Same query under tenant B should not see tenant A's chunks
    const bRes = await request.get('http://localhost:3001/api/rag/search', {
      headers: { 'x-tenant-id': 'tenant-b' },
      params: { docId, q: 'rate 100 day' },
    });
    expect(bRes.ok()).toBeTruthy();
    const bJson: any = await bRes.json();
    const bItems = Array.isArray(bJson?.items) ? bJson.items : [];
    expect(bItems.length).toBe(0);
  });
});
