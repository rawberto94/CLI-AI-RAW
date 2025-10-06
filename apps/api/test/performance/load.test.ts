import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server';

describe('API Performance Tests', () => {
  let server: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();
    authToken = 'test-jwt-token';
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const start = Date.now();
      
      const response = await server.inject({
        method: 'GET',
        url: '/healthz'
      });
      
      const duration = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(100);
    });

    it('should respond to contract list within 500ms', async () => {
      const start = Date.now();
      
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });
      
      const duration = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should respond to search queries within 1000ms', async () => {
      const start = Date.now();
      
      const response = await server.inject({
        method: 'GET',
        url: '/api/search?q=service agreement',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });
      
      const duration = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Concurrent Request Tests', () => {
    it('should handle 10 concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, () =>
        server.inject({
          method: 'GET',
          url: '/api/contracts',
          headers: {
            'authorization': `Bearer ${authToken}`,
            'x-tenant-id': 'test-tenant'
          }
        })
      );

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);
    });

    it('should handle 50 concurrent requests', async () => {
      const concurrentRequests = 50;
      const promises = Array.from({ length: concurrentRequests }, () =>
        server.inject({
          method: 'GET',
          url: '/healthz'
        })
      );

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should maintain performance under load', async () => {
      const iterations = 5;
      const concurrentRequests = 20;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const promises = Array.from({ length: concurrentRequests }, () =>
          server.inject({
            method: 'GET',
            url: '/api/contracts',
            headers: {
              'authorization': `Bearer ${authToken}`,
              'x-tenant-id': 'test-tenant'
            }
          })
        );

        const start = Date.now();
        const responses = await Promise.all(promises);
        const duration = Date.now() - start;

        durations.push(duration);

        // All requests should succeed
        responses.forEach(response => {
          expect(response.statusCode).toBe(200);
        });
      }

      // Performance should be consistent
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      expect(avgDuration).toBeLessThan(3000);
      expect(maxDuration).toBeLessThan(5000);
      
      // Performance shouldn't degrade significantly
      const firstDuration = durations[0];
      const lastDuration = durations[durations.length - 1];
      const degradation = (lastDuration - firstDuration) / firstDuration;
      
      expect(degradation).toBeLessThan(0.5); // Less than 50% degradation
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Make many requests
      for (let i = 0; i < 100; i++) {
        await server.inject({
          method: 'GET',
          url: '/api/contracts',
          headers: {
            'authorization': `Bearer ${authToken}`,
            'x-tenant-id': 'test-tenant'
          }
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Throughput Tests', () => {
    it('should achieve minimum throughput', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = Date.now();
      let requestCount = 0;
      const errors: any[] = [];

      // Make requests continuously for the test duration
      while (Date.now() - startTime < testDuration) {
        try {
          const response = await server.inject({
            method: 'GET',
            url: '/healthz'
          });
          
          if (response.statusCode === 200) {
            requestCount++;
          } else {
            errors.push({ statusCode: response.statusCode, body: response.body });
          }
        } catch (error) {
          errors.push(error);
        }
      }

      const actualDuration = Date.now() - startTime;
      const throughput = (requestCount / actualDuration) * 1000; // requests per second

      console.log(`Throughput: ${throughput.toFixed(2)} requests/second`);
      console.log(`Total requests: ${requestCount}`);
      console.log(`Errors: ${errors.length}`);

      // Should achieve at least 100 requests per second for health checks
      expect(throughput).toBeGreaterThan(100);
      
      // Error rate should be low
      const errorRate = errors.length / (requestCount + errors.length);
      expect(errorRate).toBeLessThan(0.01); // Less than 1% error rate
    });
  });

  describe('Large Payload Tests', () => {
    it('should handle large search queries', async () => {
      const largeQuery = 'a'.repeat(1000); // 1KB query
      
      const start = Date.now();
      const response = await server.inject({
        method: 'GET',
        url: `/api/search?q=${encodeURIComponent(largeQuery)}`,
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });
      const duration = Date.now() - start;

      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(2000);
    });

    it('should handle large response payloads', async () => {
      const start = Date.now();
      const response = await server.inject({
        method: 'GET',
        url: '/api/contracts?limit=100', // Large result set
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });
      const duration = Date.now() - start;

      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(3000);
      
      // Response should be properly formatted
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
    });
  });

  describe('Database Performance Tests', () => {
    it('should handle database queries efficiently', async () => {
      const queries = [
        '/api/contracts',
        '/api/contracts?status=COMPLETED',
        '/api/contracts?contractType=Service Agreement',
        '/api/search?q=contract'
      ];

      for (const query of queries) {
        const start = Date.now();
        const response = await server.inject({
          method: 'GET',
          url: query,
          headers: {
            'authorization': `Bearer ${authToken}`,
            'x-tenant-id': 'test-tenant'
          }
        });
        const duration = Date.now() - start;

        expect(response.statusCode).toBe(200);
        expect(duration).toBeLessThan(1000);
      }
    });

    it('should handle complex queries efficiently', async () => {
      const start = Date.now();
      const response = await server.inject({
        method: 'GET',
        url: '/api/cross-contract-analysis/relationships',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant'
        }
      });
      const duration = Date.now() - start;

      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(5000); // Complex analysis may take longer
    });
  });

  describe('Caching Performance Tests', () => {
    it('should benefit from caching on repeated requests', async () => {
      const url = '/api/contracts?limit=10';
      const headers = {
        'authorization': `Bearer ${authToken}`,
        'x-tenant-id': 'test-tenant'
      };

      // First request (cache miss)
      const start1 = Date.now();
      const response1 = await server.inject({
        method: 'GET',
        url,
        headers
      });
      const duration1 = Date.now() - start1;

      expect(response1.statusCode).toBe(200);

      // Second request (should be cached)
      const start2 = Date.now();
      const response2 = await server.inject({
        method: 'GET',
        url,
        headers
      });
      const duration2 = Date.now() - start2;

      expect(response2.statusCode).toBe(200);
      
      // Second request should be faster (cached)
      expect(duration2).toBeLessThanOrEqual(duration1);
      
      // Responses should be identical
      expect(response1.body).toBe(response2.body);
    });
  });
});