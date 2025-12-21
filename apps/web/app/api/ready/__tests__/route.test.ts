import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

// We need to mock the prisma import inside the function
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe('GET /api/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return ready status with all checks', async () => {
    // Mock prisma for database check
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(data.checks).toBeDefined();
    expect(Array.isArray(data.checks)).toBe(true);
  });

  it('should include database check in response', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    const dbCheck = data.checks.find((c: { name: string }) => c.name === 'database');
    expect(dbCheck).toBeDefined();
    expect(dbCheck.status).toBeDefined();
  });

  it('should report unhealthy database when connection fails', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));

    const response = await GET();
    const data = await response.json();

    const dbCheck = data.checks.find((c: { name: string }) => c.name === 'database');
    if (dbCheck) {
      expect(dbCheck.status).toBe('unhealthy');
      expect(dbCheck.message).toBeDefined();
    }
  });

  it('should include uptime in response', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.uptime).toBeDefined();
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should include version in response', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBeDefined();
    expect(typeof data.version).toBe('string');
  });

  it('should include latency for each check', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    data.checks.forEach((check: { latency?: number }) => {
      if (check.latency !== undefined) {
        expect(typeof check.latency).toBe('number');
      }
    });
  });

  it('should return not_ready status when critical checks fail', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Database down'));

    const response = await GET();
    const data = await response.json();

    // When database is down, status should be not_ready or degraded
    expect(['not_ready', 'degraded']).toContain(data.status);
  });

  it('should return valid ISO timestamp', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    const parsedDate = new Date(data.timestamp);
    expect(parsedDate.toString()).not.toBe('Invalid Date');
    // Should be close to current time (within 5 seconds)
    expect(Math.abs(parsedDate.getTime() - Date.now())).toBeLessThan(5000);
  });
});
