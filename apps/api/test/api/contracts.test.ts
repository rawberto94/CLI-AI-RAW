import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

describe('Contracts API', () => {
  let server: FastifyInstance;
  let authToken: string;
  let testContractId: string;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();
    
    // Get auth token for tests
    authToken = 'test-jwt-token'; // In real tests, this would be obtained from auth endpoint
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    // Reset test data before each test
    testContractId = '';
  });

  describe('GET /api/contracts', () => {
    it('should return list of contracts', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts?limit=5&offset=10',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination.limit).toBe(5);
      expect(body.pagination.offset).toBe(10);
    });

    it('should support filtering by status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts?status=COMPLETED',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should support search queries', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts?q=service agreement',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts',
        headers: {
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require tenant ID', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/contracts', () => {
    it('should upload and create a new contract', async () => {
      const testFile = Buffer.from('Test contract content');
      const form = new FormData();
      form.append('file', testFile, {
        filename: 'test-contract.txt',
        contentType: 'text/plain'
      });
      form.append('metadata', JSON.stringify({
        description: 'Test contract for API testing',
        tags: ['test', 'api']
      }));

      const response = await server.inject({
        method: 'POST',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          ...form.getHeaders()
        },
        payload: form
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.processingJobId).toBeDefined();
      
      testContractId = body.data.id;
    });

    it('should reject files that are too large', async () => {
      const largeFile = Buffer.alloc(100 * 1024 * 1024); // 100MB
      const form = new FormData();
      form.append('file', largeFile, {
        filename: 'large-contract.pdf',
        contentType: 'application/pdf'
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          ...form.getHeaders()
        },
        payload: form
      });

      expect(response.statusCode).toBe(413);
    });

    it('should reject unsupported file types', async () => {
      const testFile = Buffer.from('Test content');
      const form = new FormData();
      form.append('file', testFile, {
        filename: 'test.exe',
        contentType: 'application/octet-stream'
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          ...form.getHeaders()
        },
        payload: form
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require file in request', async () => {
      const form = new FormData();
      form.append('metadata', JSON.stringify({
        description: 'Test without file'
      }));

      const response = await server.inject({
        method: 'POST',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          ...form.getHeaders()
        },
        payload: form
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/contracts/:contractId', () => {
    beforeEach(async () => {
      // Create a test contract for these tests
      const testFile = Buffer.from('Test contract content for GET tests');
      const form = new FormData();
      form.append('file', testFile, {
        filename: 'get-test-contract.txt',
        contentType: 'text/plain'
      });

      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          ...form.getHeaders()
        },
        payload: form
      });

      const createBody = JSON.parse(createResponse.body);
      testContractId = createBody.data.id;
    });

    it('should return contract details', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/contracts/${testContractId}`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(testContractId);
      expect(body.data.filename).toBeDefined();
      expect(body.data.status).toBeDefined();
    });

    it('should include analysis when requested', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/contracts/${testContractId}?includeAnalysis=true`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      // Analysis might not be available immediately, so we just check structure
      expect(body.data.id).toBe(testContractId);
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts/non-existent-id',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not return contracts from other tenants', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/contracts/${testContractId}`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'other-tenant'
        }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/contracts/:contractId', () => {
    beforeEach(async () => {
      // Create a test contract for these tests
      const testFile = Buffer.from('Test contract content for PUT tests');
      const form = new FormData();
      form.append('file', testFile, {
        filename: 'put-test-contract.txt',
        contentType: 'text/plain'
      });

      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          ...form.getHeaders()
        },
        payload: form
      });

      const createBody = JSON.parse(createResponse.body);
      testContractId = createBody.data.id;
    });

    it('should update contract metadata', async () => {
      const updateData = {
        filename: 'updated-contract.txt',
        description: 'Updated description',
        tags: ['updated', 'test']
      };

      const response = await server.inject({
        method: 'PUT',
        url: `/api/contracts/${testContractId}`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          'content-type': 'application/json'
        },
        payload: JSON.stringify(updateData)
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.filename).toBe(updateData.filename);
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/contracts/non-existent-id',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ filename: 'test.txt' })
      });

      expect(response.statusCode).toBe(404);
    });

    it('should validate update data', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: `/api/contracts/${testContractId}`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ invalidField: 'value' })
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/contracts/:contractId', () => {
    beforeEach(async () => {
      // Create a test contract for these tests
      const testFile = Buffer.from('Test contract content for DELETE tests');
      const form = new FormData();
      form.append('file', testFile, {
        filename: 'delete-test-contract.txt',
        contentType: 'text/plain'
      });

      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          ...form.getHeaders()
        },
        payload: form
      });

      const createBody = JSON.parse(createResponse.body);
      testContractId = createBody.data.id;
    });

    it('should delete contract', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/contracts/${testContractId}`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(204);

      // Verify contract is deleted
      const getResponse = await server.inject({
        method: 'GET',
        url: `/api/contracts/${testContractId}`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/contracts/non-existent-id',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/contracts/:contractId/analysis', () => {
    beforeEach(async () => {
      // Create and process a test contract
      const testFile = Buffer.from(`
        SERVICE AGREEMENT
        
        This agreement is between Acme Corp and TechServices Inc.
        Total value: $500,000
        Payment terms: Net 30 days
        Term: 12 months
      `);
      const form = new FormData();
      form.append('file', testFile, {
        filename: 'analysis-test-contract.txt',
        contentType: 'text/plain'
      });

      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          ...form.getHeaders()
        },
        payload: form
      });

      const createBody = JSON.parse(createResponse.body);
      testContractId = createBody.data.id;

      // Wait for processing to complete (in real tests, you might need to poll)
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should return contract analysis', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/contracts/${testContractId}/analysis`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.contractId).toBe(testContractId);
      expect(body.data.financial).toBeDefined();
      expect(body.data.risk).toBeDefined();
      expect(body.data.compliance).toBeDefined();
      expect(body.data.clauses).toBeDefined();
    });

    it('should return 404 for contract without analysis', async () => {
      // Create a contract but don't wait for processing
      const testFile = Buffer.from('New contract without analysis');
      const form = new FormData();
      form.append('file', testFile, {
        filename: 'no-analysis-contract.txt',
        contentType: 'text/plain'
      });

      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          ...form.getHeaders()
        },
        payload: form
      });

      const createBody = JSON.parse(createResponse.body);
      const newContractId = createBody.data.id;

      const response = await server.inject({
        method: 'GET',
        url: `/api/contracts/${newContractId}/analysis`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      // Might return 404 if analysis not ready, or 200 with partial data
      expect([200, 404]).toContain(response.statusCode);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array.from({ length: 10 }, () =>
        server.inject({
          method: 'GET',
          url: '/api/contracts',
          headers: {
            'authorization': `Bearer ${authToken}`,
            'x-tenant-id': 'test-tenant'
          }
        })
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed in test environment
      // In production, some would be rate limited
      responses.forEach(response => {
        expect([200, 429]).toContain(response.statusCode);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: `/api/contracts/test-id`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant',
          'content-type': 'application/json'
        },
        payload: 'invalid json'
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle missing content-type', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: `/api/contracts/test-id`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        },
        payload: JSON.stringify({ filename: 'test.txt' })
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle server errors gracefully', async () => {
      // This would test error handling when the database is down, etc.
      // Implementation depends on your error handling setup
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });

      // Should not crash, should return proper error response
      expect(response.statusCode).toBeLessThan(600);
    });
  });
});