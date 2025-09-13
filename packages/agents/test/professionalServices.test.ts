import { describe, it, expect } from 'vitest';
import { ProfessionalServicesAnalyzer } from '../src/professionalServices';

describe('ProfessionalServicesAnalyzer', () => {
  it('produces overview and clauseMatrix without API key (fallback)', async () => {
    const analyzer = new ProfessionalServicesAnalyzer({ apiKey: undefined });
    const text = `Master Services Agreement between Acme Corp and Umbrella LLC. Payment Terms: Net 30. Confidentiality applies.`;
    const res = await analyzer.analyze(text);
    expect(res).toBeDefined();
    expect(res.overview).toBeDefined();
    expect(typeof res.overview.summary).toBe('string');
    expect(Array.isArray(res.clauseMatrix.clauses)).toBe(true);
  });
});
