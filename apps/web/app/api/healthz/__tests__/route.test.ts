import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/api-key-utils', () => ({
  isAiConfigured: vi.fn(),
  areRequiredKeysConfigured: vi.fn(),
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import { isAiConfigured, areRequiredKeysConfigured } from '@/lib/api-key-utils';

describe('GET /api/healthz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return healthy status when all services are operational', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
    vi.mocked(isAiConfigured).mockReturnValue(true);
    vi.mocked(areRequiredKeysConfigured).mockReturnValue(true);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.services).toBeDefined();
  });

  it('should return degraded status when database is down', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));
    vi.mocked(isAiConfigured).mockReturnValue(true);

    const response = await GET();
    const data = await response.json();

    // Should still return 200 but with degraded status
    expect(data.status).toBe('degraded');
    expect(data.services.database.status).toBe('down');
  });

  it('should return degraded status when AI is not configured', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
    vi.mocked(isAiConfigured).mockReturnValue(false);

    const response = await GET();
    const data = await response.json();

    expect(data.services.ai.status).toBe('degraded');
  });

  it('should include latency information for database checks', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
    vi.mocked(isAiConfigured).mockReturnValue(true);

    const response = await GET();
    const data = await response.json();

    expect(data.services.database.latency).toBeDefined();
    expect(typeof data.services.database.latency).toBe('number');
  });

  it('should include timestamp in response', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
    vi.mocked(isAiConfigured).mockReturnValue(true);

    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    // Timestamp should be a valid ISO date string
    expect(new Date(data.timestamp).toString()).not.toBe('Invalid Date');
  });
});
