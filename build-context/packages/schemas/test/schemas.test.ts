import { test, expect } from 'vitest'
import { IngestionArtifactV1Schema } from '../src/index';

test('IngestionArtifactV1Schema should validate correct data', () => {
    const data = {
        metadata: {
            docId: '123',
            fileType: 'pdf',
            totalPages: 1,
            ocrRate: 1,
            provenance: [{
                worker: 'test-worker',
                timestamp: new Date().toISOString(),
                durationMs: 100
            }]
        },
        content: 'test content'
    };
    const result = IngestionArtifactV1Schema.safeParse(data);
    if (!result.success) {
        console.error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
});
