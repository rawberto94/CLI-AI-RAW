// Advanced Benchmark Matching Algorithms for Procurement Intelligence
// Implements strict, relaxed, and historical fallback matching

import { type NormalizedRate } from './rate-normalization';

export interface BenchmarkCriteria {
  role: string;
  level: string;
  geography?: string;
  industry?: string;
  companySize?: 'Small' | 'Medium' | 'Large' | 'Enterprise';
  contractType?: string;
  matchingStrategy: 'strict' | 'relaxed' | 'historical';
}

export interface BenchmarkMatch {
  role: string;
  level: string;
  geography: string;
  industry: string;
  companySize: string;
  medianRate: number;
  percentile25: number;
  percentile75: number;
  sampleSize: number;
  lastUpdated: Date;
  confidence: number;
  matchType: 'exact' | 'similar' | 'fallback';
  similarityScore?: number;
}

export interface BenchmarkResults {
  strictMatches: BenchmarkMatch[];
  relaxedMatches: BenchmarkMatch[];
  historicalFallbacks: BenchmarkMatch[];
  recommendedMatch: BenchmarkMatch;
  overallConfidence: number;
}

export class BenchmarkMatchingService {
  private benchmarkDatabase: Map<string, BenchmarkMatch[]>;
  private roleHierarchy: Map<string, string[]>;
  private geographyHierarchy: Map<string, string[]>;
  private industryMapping: Map<string, string[]>;

  constructor() {
    this.benchmarkDatabase = new Map();
    this.initializeBenchmarkData();
    this.initializeHierarchies();
  }

  /**
   * Find benchmark matches using specified criteria and strategy
   */
  findBenchmarks(rate: NormalizedRate, criteria: BenchmarkCriteria): BenchmarkResults {
    const strictMatches = this.findStrictMatches(rate, criteria);
    const relaxedMatches = this.findRelaxedMatches(rate, criteria);
    const historicalFallbacks = this.findHistoricalFallbacks(rate, criteria);

    // Select the best match based on availability and confidence
    const recommendedMatch = this.selectBestMatch(strictMatches, relaxedMatches, historicalFallbacks);
    
    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(strictMatches, relaxedMatches, historicalFallbacks);

    return {
      strictMatches,
      relaxedMatches,
      historicalFallbacks,
      recommendedMatch,
      overallConfidence
    };
  }

  /**
   * Strict matching: Exact role, level, geography, and industry match
   */
  private findStrictMatches(rate: NormalizedRate, criteria: BenchmarkCriteria): BenchmarkMatch[] {
    const key = this.createBenchmarkKey(criteria.role, criteria.level, criteria.geography, criteria.industry);
    const matches = this.benchmarkDatabase.get(key) || [];
    
    return (matches as any)
      .filter((match: any) => this.isStrictMatch(match, criteria))
      .map((match: any) => ({ ...match, matchType: 'exact' as const, confidence: match.confidence * 1.0 }))
      .sort((a: any, b: any) => b.confidence - a.confidence);
  }

  /**
   * Relaxed matching: Similar roles, flexible geography/industry
   */
  private findRelaxedMatches(rate: NormalizedRate, criteria: BenchmarkCriteria): BenchmarkMatch[] {
    const matches: Array<BenchmarkMatch & { similarityScore: number }> = [];
    
    // Search through all benchmark data
    for (const [key, benchmarks] of this.benchmarkDatabase.entries()) {
      for (const benchmark of benchmarks) {
        const similarity = this.calculateSimilarityScore(benchmark, criteria);
        if (similarity >= 0.6) { // Minimum 60% similarity
          matches.push({
            ...benchmark,
            matchType: 'similar' as const,
            similarityScore: similarity,
            confidence: benchmark.confidence * similarity
          });
        }
      }
    }

    return matches
      .sort((a, b) => b.similarityScore! - a.similarityScore!)
      .slice(0, 10); // Top 10 similar matches
  }

  /**
   * Historical fallback: Use historical data when current data is unavailable
   */
  private findHistoricalFallbacks(rate: NormalizedRate, criteria: BenchmarkCriteria): BenchmarkMatch[] {
    // Look for historical data for the same role/level combination
    const historicalMatches: BenchmarkMatch[] = [];
    
    for (const [key, benchmarks] of this.benchmarkDatabase.entries()) {
      for (const benchmark of benchmarks) {
        if (this.isHistoricalMatch(benchmark, criteria)) {
          // Apply aging factor to confidence
          const daysSinceUpdate = Math.floor((Date.now() - benchmark.lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
          const agingFactor = Math.max(0.5, 1 - (daysSinceUpdate / 365)); // Reduce confidence over time
          
          historicalMatches.push({
            ...benchmark,
            matchType: 'fallback' as const,
            confidence: benchmark.confidence * agingFactor
          });
        }
      }
    }

    return historicalMatches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Top 5 historical matches
  }

  /**
   * Calculate similarity score between benchmark and criteria
   */
  private calculateSimilarityScore(benchmark: BenchmarkMatch, criteria: BenchmarkCriteria): number {
    let score = 0;
    let maxScore = 0;

    // Role similarity (40% weight)
    const roleScore = this.calculateRoleSimilarity(benchmark.role, criteria.role);
    score += roleScore * 0.4;
    maxScore += 0.4;

    // Level similarity (30% weight)
    const levelScore = this.calculateLevelSimilarity(benchmark.level, criteria.level);
    score += levelScore * 0.3;
    maxScore += 0.3;

    // Geography similarity (15% weight)
    if (criteria.geography) {
      const geoScore = this.calculateGeographySimilarity(benchmark.geography, criteria.geography);
      score += geoScore * 0.15;
    }
    maxScore += 0.15;

    // Industry similarity (15% weight)
    if (criteria.industry) {
      const industryScore = this.calculateIndustrySimilarity(benchmark.industry, criteria.industry);
      score += industryScore * 0.15;
    }
    maxScore += 0.15;

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Calculate role similarity using role hierarchy
   */
  private calculateRoleSimilarity(benchmarkRole: string, criteriaRole: string): number {
    if (benchmarkRole === criteriaRole) return 1.0;
    
    const roleFamily = this.roleHierarchy.get(criteriaRole) || [];
    if (roleFamily.includes(benchmarkRole)) return 0.8;
    
    // Check if roles are in similar families
    for (const [family, roles] of this.roleHierarchy.entries()) {
      if (roles.includes(criteriaRole) && roles.includes(benchmarkRole)) {
        return 0.6;
      }
    }
    
    return 0.2; // Minimal similarity for different role families
  }

  /**
   * Calculate level similarity
   */
  private calculateLevelSimilarity(benchmarkLevel: string, criteriaLevel: string): number {
    if (benchmarkLevel === criteriaLevel) return 1.0;
    
    const levelHierarchy = ['Junior', 'Mid', 'Senior', 'Principal', 'Executive'];
    const benchmarkIndex = levelHierarchy.indexOf(benchmarkLevel);
    const criteriaIndex = levelHierarchy.indexOf(criteriaLevel);
    
    if (benchmarkIndex === -1 || criteriaIndex === -1) return 0.5;
    
    const distance = Math.abs(benchmarkIndex - criteriaIndex);
    return Math.max(0, 1 - (distance * 0.3));
  }

  /**
   * Calculate geography similarity using hierarchy
   */
  private calculateGeographySimilarity(benchmarkGeo: string, criteriaGeo: string): number {
    if (benchmarkGeo === criteriaGeo) return 1.0;
    
    const geoFamily = this.geographyHierarchy.get(criteriaGeo) || [];
    if (geoFamily.includes(benchmarkGeo)) return 0.7;
    
    return 0.3; // Different regions
  }

  /**
   * Calculate industry similarity
   */
  private calculateIndustrySimilarity(benchmarkIndustry: string, criteriaIndustry: string): number {
    if (benchmarkIndustry === criteriaIndustry) return 1.0;
    
    const industryFamily = this.industryMapping.get(criteriaIndustry) || [];
    if (industryFamily.includes(benchmarkIndustry)) return 0.8;
    
    return 0.4; // Different industries
  }

  /**
   * Check if benchmark is a strict match
   */
  private isStrictMatch(benchmark: BenchmarkMatch, criteria: BenchmarkCriteria): boolean {
    return benchmark.role === criteria.role &&
           benchmark.level === criteria.level &&
           (!criteria.geography || benchmark.geography === criteria.geography) &&
           (!criteria.industry || benchmark.industry === criteria.industry);
  }

  /**
   * Check if benchmark is suitable for historical fallback
   */
  private isHistoricalMatch(benchmark: BenchmarkMatch, criteria: BenchmarkCriteria): boolean {
    return benchmark.role === criteria.role &&
           benchmark.level === criteria.level &&
           benchmark.sampleSize >= 5; // Minimum sample size for reliability
  }

  /**
   * Select the best match from available options
   */
  private selectBestMatch(strict: BenchmarkMatch[], relaxed: BenchmarkMatch[], historical: BenchmarkMatch[]): BenchmarkMatch {
    // Prefer strict matches
    if (strict.length > 0) {
      return strict[0];
    }
    
    // Then relaxed matches
    if (relaxed.length > 0) {
      return relaxed[0];
    }
    
    // Finally historical fallbacks
    if (historical.length > 0) {
      return historical[0];
    }
    
    // Default fallback
    return this.createDefaultBenchmark();
  }

  /**
   * Calculate overall confidence based on available matches
   */
  private calculateOverallConfidence(strict: BenchmarkMatch[], relaxed: BenchmarkMatch[], historical: BenchmarkMatch[]): number {
    if (strict.length > 0) {
      return Math.min(0.95, strict[0].confidence);
    }
    
    if (relaxed.length > 0) {
      return Math.min(0.85, relaxed[0].confidence);
    }
    
    if (historical.length > 0) {
      return Math.min(0.70, historical[0].confidence);
    }
    
    return 0.50; // Low confidence for default fallback
  }

  /**
   * Create benchmark key for database lookup
   */
  private createBenchmarkKey(role: string, level: string, geography?: string, industry?: string): string {
    return `${role}|${level}|${geography || 'ANY'}|${industry || 'ANY'}`;
  }

  /**
   * Create default benchmark when no matches found
   */
  private createDefaultBenchmark(): BenchmarkMatch {
    return {
      role: 'Generic Professional',
      level: 'Mid',
      geography: 'Global',
      industry: 'Technology',
      companySize: 'Medium',
      medianRate: 120,
      percentile25: 100,
      percentile75: 140,
      sampleSize: 100,
      lastUpdated: new Date(),
      confidence: 0.5,
      matchType: 'fallback'
    };
  }

  /**
   * Initialize benchmark database with sample data
   */
  private initializeBenchmarkData(): void {
    const benchmarks: BenchmarkMatch[] = [
      // Senior Consultant benchmarks
      {
        role: 'Senior Consultant',
        level: 'Senior',
        geography: 'North America',
        industry: 'Technology',
        medianRate: 165,
        percentile25: 150,
        percentile75: 185,
        sampleSize: 250,
        lastUpdated: new Date('2024-01-01'),
        confidence: 0.9,
        matchType: 'exact',
        companySize: 'Medium'
      },
      {
        role: 'Senior Consultant',
        level: 'Senior',
        geography: 'Europe',
        industry: 'Technology',
        medianRate: 155,
        percentile25: 140,
        percentile75: 175,
        sampleSize: 180,
        lastUpdated: new Date('2024-01-01'),
        confidence: 0.85,
        matchType: 'exact',
        companySize: 'Medium'
      },
      // Project Manager benchmarks
      {
        role: 'Project Manager',
        level: 'Senior',
        geography: 'North America',
        industry: 'Technology',
        medianRate: 145,
        percentile25: 130,
        percentile75: 165,
        sampleSize: 300,
        lastUpdated: new Date('2024-01-01'),
        confidence: 0.9,
        matchType: 'exact',
        companySize: 'Medium'
      },
      // Developer benchmarks
      {
        role: 'Senior Developer',
        level: 'Senior',
        geography: 'North America',
        industry: 'Technology',
        medianRate: 155,
        percentile25: 140,
        percentile75: 175,
        sampleSize: 400,
        lastUpdated: new Date('2024-01-01'),
        confidence: 0.95,
        matchType: 'exact',
        companySize: 'Medium'
      },
      {
        role: 'Developer',
        level: 'Mid',
        geography: 'North America',
        industry: 'Technology',
        medianRate: 115,
        percentile25: 100,
        percentile75: 130,
        sampleSize: 500,
        lastUpdated: new Date('2024-01-01'),
        confidence: 0.9,
        matchType: 'exact',
        companySize: 'Medium'
      }
    ];

    // Organize benchmarks by key
    benchmarks.forEach(benchmark => {
      const key = this.createBenchmarkKey(benchmark.role, benchmark.level, benchmark.geography, benchmark.industry);
      if (!this.benchmarkDatabase.has(key)) {
        this.benchmarkDatabase.set(key, []);
      }
      this.benchmarkDatabase.get(key)!.push(benchmark);
    });
  }

  /**
   * Initialize role, geography, and industry hierarchies
   */
  private initializeHierarchies(): void {
    // Role hierarchy - similar roles grouped together
    this.roleHierarchy = new Map([
      ['Consultant', ['Senior Consultant', 'Principal Consultant', 'Management Consultant', 'Strategy Consultant']],
      ['Developer', ['Senior Developer', 'Lead Developer', 'Software Engineer', 'Full Stack Developer']],
      ['Manager', ['Project Manager', 'Program Manager', 'Delivery Manager', 'Scrum Master']],
      ['Analyst', ['Business Analyst', 'Data Analyst', 'Systems Analyst', 'Financial Analyst']],
      ['Architect', ['Technical Architect', 'Solution Architect', 'Enterprise Architect', 'Cloud Architect']],
      ['Designer', ['UX Designer', 'UI Designer', 'Product Designer', 'Graphic Designer']],
      ['Engineer', ['DevOps Engineer', 'QA Engineer', 'Test Engineer', 'Site Reliability Engineer']]
    ]);

    // Geography hierarchy
    this.geographyHierarchy = new Map([
      ['North America', ['United States', 'Canada', 'Mexico']],
      ['Europe', ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Switzerland']],
      ['Asia Pacific', ['Australia', 'Singapore', 'Japan', 'India', 'China']],
      ['Global', ['North America', 'Europe', 'Asia Pacific']]
    ]);

    // Industry mapping
    this.industryMapping = new Map([
      ['Technology', ['Software', 'Hardware', 'Telecommunications', 'Internet']],
      ['Financial Services', ['Banking', 'Insurance', 'Investment', 'Fintech']],
      ['Healthcare', ['Pharmaceuticals', 'Medical Devices', 'Healthcare Services']],
      ['Manufacturing', ['Automotive', 'Aerospace', 'Industrial', 'Consumer Goods']],
      ['Consulting', ['Management Consulting', 'IT Consulting', 'Strategy Consulting']]
    ]);
  }

  /**
   * Add new benchmark data
   */
  addBenchmark(benchmark: BenchmarkMatch): void {
    const key = this.createBenchmarkKey(benchmark.role, benchmark.level, benchmark.geography, benchmark.industry);
    if (!this.benchmarkDatabase.has(key)) {
      this.benchmarkDatabase.set(key, []);
    }
    this.benchmarkDatabase.get(key)!.push(benchmark);
  }

  /**
   * Get all available benchmark keys
   */
  getAvailableBenchmarks(): string[] {
    return Array.from(this.benchmarkDatabase.keys());
  }

  /**
   * Get benchmark statistics
   */
  getBenchmarkStats(): { totalBenchmarks: number; roles: number; geographies: number; industries: number } {
    let totalBenchmarks = 0;
    const roles = new Set<string>();
    const geographies = new Set<string>();
    const industries = new Set<string>();

    for (const benchmarks of this.benchmarkDatabase.values()) {
      totalBenchmarks += benchmarks.length;
      benchmarks.forEach(b => {
        roles.add(b.role);
        geographies.add(b.geography);
        industries.add(b.industry);
      });
    }

    return {
      totalBenchmarks,
      roles: roles.size,
      geographies: geographies.size,
      industries: industries.size
    };
  }
}

// Export singleton instance
export const benchmarkMatcher = new BenchmarkMatchingService();

// Utility functions
export function findBestBenchmark(rate: NormalizedRate, criteria: BenchmarkCriteria): BenchmarkMatch {
  const results = benchmarkMatcher.findBenchmarks(rate, criteria);
  return results.recommendedMatch;
}

export function calculateVariance(currentRate: number, benchmarkRate: number): { variance: number; variantStr: string } {
  const variance = ((currentRate - benchmarkRate) / benchmarkRate) * 100;
  const variantStr = variance >= 0 ? `+${variance.toFixed(1)}%` : `${variance.toFixed(1)}%`;
  return { variance, variantStr };
}