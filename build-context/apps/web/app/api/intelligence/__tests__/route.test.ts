import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/intelligence'
): NextRequest {
  return new NextRequest(new URL(url), { method });
}

describe('GET /api/intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return full intelligence summary by default', async () => {
    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    // Data is nested under 'data' property
    const data = json.data;
    expect(data.healthScores).toBeDefined();
    expect(data.insights).toBeDefined();
    expect(data.recentActivity).toBeDefined();
    expect(data.aiCapabilities).toBeDefined();
  });

  it('should return only health scores when section=health', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/intelligence?section=health');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.healthScores).toBeDefined();
    expect(json.data.insights).toBeUndefined();
    expect(json.data.recentActivity).toBeUndefined();
  });

  it('should return only insights when section=insights', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/intelligence?section=insights');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.insights).toBeDefined();
    expect(json.data.healthScores).toBeUndefined();
    expect(json.data.recentActivity).toBeUndefined();
  });

  it('should return only recent activity when section=activity', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/intelligence?section=activity');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.recentActivity).toBeDefined();
    expect(json.data.healthScores).toBeUndefined();
    expect(json.data.insights).toBeUndefined();
  });

  it('should include health score metrics', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/intelligence?section=health');
    const response = await GET(request);
    const json = await response.json();

    expect(json.data.healthScores).toEqual(
      expect.objectContaining({
        average: expect.any(Number),
        healthy: expect.any(Number),
        atRisk: expect.any(Number),
        critical: expect.any(Number),
      })
    );
  });

  it('should include insight types', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/intelligence?section=insights');
    const response = await GET(request);
    const json = await response.json();

    expect(json.data.insights).toBeInstanceOf(Array);
    if (json.data.insights.length > 0) {
      expect(json.data.insights[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          type: expect.any(String),
          severity: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
        })
      );
    }
  });

  it('should include AI capabilities information', async () => {
    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(json.data.aiCapabilities).toEqual(
      expect.objectContaining({
        searchEnabled: expect.any(Boolean),
        healthScoresEnabled: expect.any(Boolean),
        negotiationCopilotEnabled: expect.any(Boolean),
        knowledgeGraphEnabled: expect.any(Boolean),
      })
    );
  });

  it('should include recent activity items', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/intelligence?section=activity');
    const response = await GET(request);
    const json = await response.json();

    expect(json.data.recentActivity).toBeInstanceOf(Array);
    if (json.data.recentActivity.length > 0) {
      expect(json.data.recentActivity[0]).toEqual(
        expect.objectContaining({
          type: expect.any(String),
          message: expect.any(String),
          time: expect.any(String),
        })
      );
    }
  });

  it('should categorize insights by severity', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/intelligence?section=insights');
    const response = await GET(request);
    const json = await response.json();

    const severities = json.data.insights.map((i: { severity: string }) => i.severity);
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    severities.forEach((sev: string) => {
      expect(validSeverities).toContain(sev);
    });
  });

  it('should categorize insights by type', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/intelligence?section=insights');
    const response = await GET(request);
    const json = await response.json();

    const types = new Set(json.data.insights.map((i: { type: string }) => i.type));
    // Should have various insight types like 'risk', 'opportunity', 'compliance'
    expect(types.size).toBeGreaterThanOrEqual(1);
  });
});
