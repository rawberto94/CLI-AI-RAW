/**
 * Unit Tests for Contract AI Analyst API
 * Tests /api/ai/contract-analyst endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to ensure mock is created before module mocking
const { mockOpenAICreate } = vi.hoisted(() => ({
  mockOpenAICreate: vi.fn(),
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: vi.fn(),
    },
    aIUsageLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock RAG service
vi.mock('@/lib/rag/advanced-rag.service', () => ({
  hybridSearch: vi.fn(),
}));

// Mock OpenAI - class mock that returns instance with our mock function
vi.mock('openai', () => {
  const MockOpenAI = function() {
    return {
      chat: {
        completions: {
          create: mockOpenAICreate,
        },
      },
    };
  };
  return { default: MockOpenAI };
});

// Import after mocking
import { POST } from '../route';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';

const mockGetServerSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);
const mockHybridSearch = vi.mocked(hybridSearch);

// Helper to create mock request
function createRequest(body: object) {
  return new NextRequest('http://localhost/api/ai/contract-analyst', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Contract AI Analyst API', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      tenantId: 'tenant-456',
      email: 'test@example.com',
    },
  };

  const mockContract = {
    id: 'contract-789',
    contractTitle: 'IT Services Agreement',
    fileName: 'contract.pdf',
    originalName: 'IT_Services_2024.pdf',
    status: 'COMPLETED',
    rawText: 'This is a sample contract text for testing purposes...',
    supplierName: 'Tech Corp',
    contractType: 'IT Services',
    totalValue: 100000,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-31'),
    tenantId: 'tenant-456',
  };

  const mockSearchResults = [
    {
      text: 'The payment terms shall be Net 30 from invoice date.',
      score: 0.92,
      metadata: {
        section: 'Payment Terms',
        pageNumber: 5,
        heading: 'Article 4: Payment',
      },
    },
    {
      text: 'Late payments will incur a 1.5% monthly interest charge.',
      score: 0.85,
      metadata: {
        section: 'Late Fees',
        pageNumber: 5,
      },
    },
  ];

  const mockOpenAIResponse = {
    choices: [
      {
        message: {
          content: 'Based on the contract, the payment terms are Net 30 from invoice date.',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 500,
      completion_tokens: 100,
      total_tokens: 600,
    },
  };

  // Kept for potential future use in multi-turn conversation tests
  const _mockSuggestionsResponse = {
    choices: [
      {
        message: {
          content: '["What happens if payment is late?", "Are there any discounts for early payment?", "What is the invoicing schedule?"]',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';

    // Default session setup
    mockGetServerSession.mockResolvedValue(mockSession as any);
    
    // Default OpenAI response - always returns same response for any call
    mockOpenAICreate.mockResolvedValue(mockOpenAIResponse);
    
    // Re-setup Prisma aIUsageLog mock after clearAllMocks
    mockPrisma.aIUsageLog.create.mockResolvedValue({} as any);
  });

  describe('POST /api/ai/contract-analyst', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the payment terms?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when contractId is missing', async () => {
      const request = createRequest({
        query: 'What are the payment terms?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Contract ID and query are required');
    });

    it('returns 400 when query is missing', async () => {
      const request = createRequest({
        contractId: 'contract-789',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Contract ID and query are required');
    });

    it('returns 404 when contract not found', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue(null);

      const request = createRequest({
        contractId: 'nonexistent-contract',
        query: 'What are the payment terms?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Contract not found or access denied');
    });

    it('verifies tenant isolation in contract query', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue(null);

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the payment terms?',
      });

      await POST(request);

      expect(mockPrisma.contract.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'contract-789',
          tenantId: 'tenant-456',
        },
        select: expect.objectContaining({
          id: true,
          contractTitle: true,
          tenantId: true,
        }),
      });
    });

    it('returns 503 when OpenAI API key is not configured', async () => {
      delete process.env.OPENAI_API_KEY;
      mockPrisma.contract.findFirst.mockResolvedValue(mockContract as any);

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the payment terms?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('AI service not configured');
    });

    it('uses RAG search with correct contract filter', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue(mockContract as any);
      mockHybridSearch.mockResolvedValue(mockSearchResults as any);

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the payment terms?',
      });

      await POST(request);

      expect(mockHybridSearch).toHaveBeenCalledWith(
        'What are the payment terms?',
        expect.objectContaining({
          filters: {
            contractIds: ['contract-789'],
            tenantId: 'tenant-456',
          },
        })
      );
    });

    it('falls back to rawText when no RAG results found', async () => {

      mockPrisma.contract.findFirst.mockResolvedValue(mockContract as any);
      mockHybridSearch.mockResolvedValue([]);

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What is the contract about?',
      });

      const response = await POST(request);
      
      // Should still succeed using rawText fallback
      expect(response.status).toBe(200);
      expect(mockHybridSearch).toHaveBeenCalled();
    });

    it('successfully processes a contract query', async () => {

      mockPrisma.contract.findFirst.mockResolvedValue(mockContract as any);
      mockHybridSearch.mockResolvedValue(mockSearchResults as any);

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the payment terms?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.answer).toBeDefined();
      expect(data.sources).toBeDefined();
      expect(data.confidence).toBeDefined();
    });

    it('passes custom context when provided', async () => {

      mockPrisma.contract.findFirst.mockResolvedValue(mockContract as any);
      mockHybridSearch.mockResolvedValue(mockSearchResults as any);

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the risks?',
        context: {
          name: 'Custom Contract Name',
          supplier: 'Custom Supplier',
          type: 'Custom Type',
          value: 250000,
        },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(mockHybridSearch).toHaveBeenCalled();
    });
  });

  describe('Response format', () => {
    it('returns properly structured response with sources', async () => {

      mockPrisma.contract.findFirst.mockResolvedValue(mockContract as any);
      mockHybridSearch.mockResolvedValue(mockSearchResults as any);

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the payment terms?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('answer');
      expect(data).toHaveProperty('confidence');
      expect(data).toHaveProperty('sources');
      expect(Array.isArray(data.sources)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('handles Prisma errors gracefully', async () => {
      mockPrisma.contract.findFirst.mockRejectedValue(new Error('Database error'));

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the payment terms?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('handles RAG search errors gracefully', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue(mockContract as any);
      mockHybridSearch.mockRejectedValue(new Error('Search service unavailable'));

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the payment terms?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('handles OpenAI API errors gracefully', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue(mockContract as any);
      mockHybridSearch.mockResolvedValue(mockSearchResults as any);
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI API error'));

      const request = createRequest({
        contractId: 'contract-789',
        query: 'What are the payment terms?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
