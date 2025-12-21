/**
 * Unit Tests for Upload API (Compatibility Route)
 * Tests /api/upload endpoint that forwards to /api/contracts/upload
 * 
 * This route is a simple proxy that forwards requests to /api/contracts/upload.
 * Due to vitest mock limitations with NextRequest/NextResponse, we test the
 * route logic using custom mocks that simulate real behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Use vi.hoisted to define mocks before vi.mock hoisting
const { mockCorsAddHeaders, mockCorsOptions } = vi.hoisted(() => ({
  mockCorsAddHeaders: vi.fn((response) => response),
  mockCorsOptions: vi.fn(() => NextResponse.json(null, { status: 204 })),
}));

// Mock CORS module before imports
vi.mock('@/lib/security/cors', () => ({
  default: {
    addCorsHeaders: mockCorsAddHeaders,
    optionsResponse: mockCorsOptions,
  },
}));

// Import after mocking
import { POST, OPTIONS } from '../route';

describe('Upload API (Compatibility Route)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('POST /api/upload - Forwarding Behavior', () => {
    it('should call fetch to forward request to /api/contracts/upload', async () => {
      const mockHeaders = new Headers({ 'x-tenant-id': 'test-tenant' });
      const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
      
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        headers: mockHeaders,
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await POST(mockRequest as any);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should construct correct URL path for forwarding', async () => {
      const mockHeaders = new Headers({ 'x-tenant-id': 'test-tenant' });
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        headers: mockHeaders,
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await POST(mockRequest as any);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/contracts/upload');
      expect(calledUrl).not.toContain('/api/upload/upload'); // No double path
    });

    it('should use POST method when forwarding', async () => {
      const mockHeaders = new Headers({ 'x-tenant-id': 'test-tenant' });
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        headers: mockHeaders,
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await POST(mockRequest as any);

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.method).toBe('POST');
    });

    it('should forward headers to target endpoint', async () => {
      const mockHeaders = new Headers({ 
        'x-tenant-id': 'test-tenant',
        'authorization': 'Bearer token123',
      });
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        headers: mockHeaders,
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await POST(mockRequest as any);

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.headers).toBe(mockHeaders);
    });

    it('should include body in forwarded request', async () => {
      const mockHeaders = new Headers({ 'x-tenant-id': 'test-tenant' });
      const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
      
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        headers: mockHeaders,
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await POST(mockRequest as any);

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.body).toBeInstanceOf(Blob);
    });

    it('should include duplex option for streaming', async () => {
      const mockHeaders = new Headers({ 'x-tenant-id': 'test-tenant' });
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        headers: mockHeaders,
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await POST(mockRequest as any);

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.duplex).toBe('half');
    });

    it('should add CORS headers to successful response', async () => {
      const mockHeaders = new Headers({ 'x-tenant-id': 'test-tenant' });
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        headers: mockHeaders,
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await POST(mockRequest as any);

      expect(mockCorsAddHeaders).toHaveBeenCalled();
    });
  });

  describe('POST /api/upload - Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockHeaders = new Headers({ 'x-tenant-id': 'test-tenant' });
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        headers: mockHeaders,
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      // Should not throw
      const response = await POST(mockRequest as any);
      
      // Should add CORS headers even on error
      expect(mockCorsAddHeaders).toHaveBeenCalled();
    });

    it('should handle blob() failure gracefully', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        headers: new Headers(),
        blob: vi.fn().mockRejectedValue(new Error('Blob error')),
      };

      // Should not throw
      await POST(mockRequest as any);
      
      // Should add CORS headers even on error
      expect(mockCorsAddHeaders).toHaveBeenCalled();
    });
  });

  describe('OPTIONS /api/upload', () => {
    it('should call cors.optionsResponse for preflight', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        method: 'OPTIONS',
      };

      await OPTIONS(mockRequest as any);

      expect(mockCorsOptions).toHaveBeenCalledWith(mockRequest, 'POST, OPTIONS');
    });

    it('should return response from cors.optionsResponse', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/upload',
        method: 'OPTIONS',
      };

      const response = await OPTIONS(mockRequest as any);

      expect(response).toBeDefined();
    });
  });
});
