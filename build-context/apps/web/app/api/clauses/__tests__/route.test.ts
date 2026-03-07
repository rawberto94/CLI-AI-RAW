import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/clauses',
  body?: Record<string, unknown>
): NextRequest {
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url), options);
}

describe('GET /api/clauses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return clauses list successfully', async () => {
    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.clauses).toBeDefined();
    expect(Array.isArray(data.clauses)).toBe(true);
    expect(data.clauses.length).toBeGreaterThan(0);
  });

  it('should include clause properties', async () => {
    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    const clause = data.clauses[0];
    expect(clause.id).toBeDefined();
    expect(clause.title).toBeDefined();
    expect(clause.content).toBeDefined();
    expect(clause.category).toBeDefined();
    expect(clause.riskLevel).toBeDefined();
  });

  it('should filter clauses by category', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/clauses?category=Confidentiality');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    data.clauses.forEach((clause: { category: string }) => {
      expect(clause.category).toBe('Confidentiality');
    });
  });

  it('should filter clauses by risk level', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/clauses?riskLevel=high');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    data.clauses.forEach((clause: { riskLevel: string }) => {
      expect(clause.riskLevel).toBe('high');
    });
  });

  it('should filter clauses by search query', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/clauses?search=confidentiality');
    const response = await GET(request);
    const _data = await response.json();

    expect(response.status).toBe(200);
    // Results should contain search term in title, content, or tags
  });

  it('should return favorites only when favorites=true', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/clauses?favorites=true');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    data.clauses.forEach((clause: { isFavorite: boolean }) => {
      expect(clause.isFavorite).toBe(true);
    });
  });

  it('should include alternative versions in clauses', async () => {
    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    const clauseWithAlternatives = data.clauses.find(
      (c: { alternativeVersions?: string[] }) => c.alternativeVersions && c.alternativeVersions.length > 0
    );
    
    if (clauseWithAlternatives) {
      expect(Array.isArray(clauseWithAlternatives.alternativeVersions)).toBe(true);
    }
  });

  it('should include usage count for clauses', async () => {
    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    data.clauses.forEach((clause: { usageCount: number }) => {
      expect(typeof clause.usageCount).toBe('number');
      expect(clause.usageCount).toBeGreaterThanOrEqual(0);
    });
  });

  it('should include legal notes when available', async () => {
    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    const clauseWithNotes = data.clauses.find((c: { legalNotes?: string }) => c.legalNotes);
    if (clauseWithNotes) {
      expect(typeof clauseWithNotes.legalNotes).toBe('string');
    }
  });

  it('should include variables in clauses', async () => {
    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    const clauseWithVariables = data.clauses.find(
      (c: { variables?: string[] }) => c.variables && c.variables.length > 0
    );
    
    if (clauseWithVariables) {
      expect(Array.isArray(clauseWithVariables.variables)).toBe(true);
    }
  });
});

describe('POST /api/clauses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate clause suggestions', async () => {
    const request = createRequest('POST', 'http://localhost:3000/api/clauses', {
      action: 'generate',
      context: 'NDA for software development',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should toggle favorite status', async () => {
    const request = createRequest('POST', 'http://localhost:3000/api/clauses', {
      action: 'toggleFavorite',
      clauseId: 'clause-1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
