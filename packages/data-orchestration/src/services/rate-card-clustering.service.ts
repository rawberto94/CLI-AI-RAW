/**
 * Rate Card Clustering Service
 * 
 * Implements intelligent clustering of rate cards using K-means algorithm
 * to identify similar rate cards for consolidation and optimization opportunities.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ClusterFeatures {
  roleStandardized: string;
  roleCategory: string;
  seniority: string;
  lineOfService: string;
  country: string;
  region: string;
  dailyRateUSD: number;
  supplierTier: string;
}

export interface NormalizedFeatures {
  roleHash: number;
  categoryHash: number;
  seniorityLevel: number;
  serviceHash: number;
  countryHash: number;
  regionHash: number;
  normalizedRate: number;
  tierLevel: number;
}

export interface ClusterCharacteristics {
  avgRate: number;
  minRate: number;
  maxRate: number;
  rateRange: { min: number; max: number };
  commonRoles: string[];
  commonGeographies: string[];
  supplierCount: number;
  seniorityDistribution: Record<string, number>;
  serviceLineDistribution: Record<string, number>;
}

export interface RateCardCluster {
  id: string;
  name: string;
  memberCount: number;
  characteristics: ClusterCharacteristics;
  consolidationSavings: number;
  members: string[]; // rate card entry IDs
  centroid: NormalizedFeatures;
}

export interface ClusterOptions {
  k?: number; // Number of clusters (default: auto-determine)
  maxIterations?: number;
  convergenceThreshold?: number;
  minClusterSize?: number;
}

export class RateCardClusteringService {
  /**
   * Cluster rate cards using K-means algorithm
   */
  async clusterRateCards(
    tenantId: string,
    options: ClusterOptions = {}
  ): Promise<RateCardCluster[]> {
    const {
      k,
      maxIterations = 100,
      convergenceThreshold = 0.001,
      minClusterSize = 3,
    } = options;

    // Fetch all rate card entries for the tenant
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        dataQuality: { in: ['HIGH', 'MEDIUM'] }, // Only cluster quality data
      },
      select: {
        id: true,
        roleStandardized: true,
        roleCategory: true,
        seniority: true,
        lineOfService: true,
        country: true,
        region: true,
        dailyRateUSD: true,
        supplierTier: true,
        supplierId: true,
        supplierName: true,
      },
    });

    if (rateCards.length < minClusterSize) {
      throw new Error(
        `Insufficient data for clustering. Need at least ${minClusterSize} rate cards, found ${rateCards.length}`
      );
    }

    // Extract and normalize features
    const features = rateCards.map((rc) => this.extractFeatures(rc));
    const normalizedFeatures = features.map((f) => this.normalizeFeatures(f));

    // Determine optimal k if not provided
    const optimalK = k || this.determineOptimalK(normalizedFeatures);

    // Perform K-means clustering
    const { clusters, centroids } = this.kMeansClustering(
      normalizedFeatures,
      optimalK,
      maxIterations,
      convergenceThreshold
    );

    // Build cluster objects with characteristics
    const clusterResults: RateCardCluster[] = [];

    for (let i = 0; i < optimalK; i++) {
      const memberIndices = clusters
        .map((cluster, idx) => (cluster === i ? idx : -1))
        .filter((idx) => idx !== -1);

      if (memberIndices.length < minClusterSize) {
        continue; // Skip small clusters
      }

      const memberRateCards = memberIndices.map((idx) => rateCards[idx]);
      const characteristics = this.calculateClusterCharacteristics(memberRateCards);
      const consolidationSavings = this.estimateConsolidationSavings(memberRateCards);

      clusterResults.push({
        id: `cluster-${i}`,
        name: this.generateClusterName(characteristics),
        memberCount: memberIndices.length,
        characteristics,
        consolidationSavings,
        members: memberRateCards.map((rc) => rc.id),
        centroid: centroids[i],
      });
    }

    return clusterResults.sort((a, b) => b.consolidationSavings - a.consolidationSavings);
  }

  /**
   * Extract features from a rate card entry
   */
  private extractFeatures(rateCard: any): ClusterFeatures {
    return {
      roleStandardized: rateCard.roleStandardized,
      roleCategory: rateCard.roleCategory,
      seniority: rateCard.seniority,
      lineOfService: rateCard.lineOfService,
      country: rateCard.country,
      region: rateCard.region,
      dailyRateUSD: parseFloat(rateCard.dailyRateUSD.toString()),
      supplierTier: rateCard.supplierTier,
    };
  }

  /**
   * Normalize features to 0-1 scale for clustering
   */
  private normalizeFeatures(features: ClusterFeatures): NormalizedFeatures {
    // Hash categorical features to numeric values
    const roleHash = this.hashString(features.roleStandardized) % 1000;
    const categoryHash = this.hashString(features.roleCategory) % 1000;
    const serviceHash = this.hashString(features.lineOfService) % 1000;
    const countryHash = this.hashString(features.country) % 1000;
    const regionHash = this.hashString(features.region) % 1000;

    // Map seniority to numeric scale
    const seniorityMap: Record<string, number> = {
      JUNIOR: 1,
      MID: 2,
      SENIOR: 3,
      PRINCIPAL: 4,
      PARTNER: 5,
    };
    const seniorityLevel = seniorityMap[features.seniority] || 2;

    // Map supplier tier to numeric scale
    const tierMap: Record<string, number> = {
      BIG_4: 4,
      TIER_2: 3,
      BOUTIQUE: 2,
      OFFSHORE: 1,
    };
    const tierLevel = tierMap[features.supplierTier] || 2;

    // Normalize rate (assuming typical range 100-2000 USD/day)
    const normalizedRate = Math.min(Math.max((features.dailyRateUSD - 100) / 1900, 0), 1);

    return {
      roleHash: roleHash / 1000,
      categoryHash: categoryHash / 1000,
      seniorityLevel: seniorityLevel / 5,
      serviceHash: serviceHash / 1000,
      countryHash: countryHash / 1000,
      regionHash: regionHash / 1000,
      normalizedRate,
      tierLevel: tierLevel / 4,
    };
  }

  /**
   * Simple string hashing function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Determine optimal number of clusters using elbow method
   */
  private determineOptimalK(features: NormalizedFeatures[]): number {
    const maxK = Math.min(10, Math.floor(features.length / 5));
    const wcss: number[] = [];

    for (let k = 2; k <= maxK; k++) {
      const { clusters, centroids } = this.kMeansClustering(features, k, 50, 0.01);
      const withinClusterSS = this.calculateWCSS(features, clusters, centroids);
      wcss.push(withinClusterSS);
    }

    // Find elbow point (simplified - use rate of change)
    let optimalK = 3; // Default
    let maxDelta = 0;

    for (let i = 1; i < wcss.length - 1; i++) {
      const delta = wcss[i - 1] - wcss[i] - (wcss[i] - wcss[i + 1]);
      if (delta > maxDelta) {
        maxDelta = delta;
        optimalK = i + 2;
      }
    }

    return optimalK;
  }

  /**
   * K-means clustering algorithm
   */
  private kMeansClustering(
    features: NormalizedFeatures[],
    k: number,
    maxIterations: number,
    convergenceThreshold: number
  ): { clusters: number[]; centroids: NormalizedFeatures[] } {
    const n = features.length;

    // Initialize centroids randomly
    let centroids = this.initializeCentroids(features, k);
    let clusters = new Array(n).fill(0);
    let prevCentroids: NormalizedFeatures[] = [];

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign each point to nearest centroid
      for (let i = 0; i < n; i++) {
        let minDistance = Infinity;
        let closestCentroid = 0;

        for (let j = 0; j < k; j++) {
          const distance = this.euclideanDistance(features[i], centroids[j]);
          if (distance < minDistance) {
            minDistance = distance;
            closestCentroid = j;
          }
        }

        clusters[i] = closestCentroid;
      }

      // Update centroids
      prevCentroids = [...centroids];
      centroids = this.updateCentroids(features, clusters, k);

      // Check convergence
      const centroidShift = this.calculateCentroidShift(prevCentroids, centroids);
      if (centroidShift < convergenceThreshold) {
        break;
      }
    }

    return { clusters, centroids };
  }

  /**
   * Initialize centroids using k-means++ algorithm
   */
  private initializeCentroids(features: NormalizedFeatures[], k: number): NormalizedFeatures[] {
    const centroids: NormalizedFeatures[] = [];
    const n = features.length;

    // Choose first centroid randomly
    centroids.push(features[Math.floor(Math.random() * n)]);

    // Choose remaining centroids
    for (let i = 1; i < k; i++) {
      const distances = features.map((f) => {
        const minDist = Math.min(...centroids.map((c) => this.euclideanDistance(f, c)));
        return minDist * minDist;
      });

      const totalDist = distances.reduce((sum, d) => sum + d, 0);
      let random = Math.random() * totalDist;

      for (let j = 0; j < n; j++) {
        random -= distances[j];
        if (random <= 0) {
          centroids.push(features[j]);
          break;
        }
      }
    }

    return centroids;
  }

  /**
   * Calculate Euclidean distance between two feature vectors
   */
  private euclideanDistance(a: NormalizedFeatures, b: NormalizedFeatures): number {
    const weights = {
      roleHash: 2.0, // Higher weight for role similarity
      categoryHash: 1.5,
      seniorityLevel: 1.0,
      serviceHash: 1.5,
      countryHash: 2.0, // Higher weight for geography
      regionHash: 1.0,
      normalizedRate: 1.5, // Important for cost optimization
      tierLevel: 0.5,
    };

    let sum = 0;
    for (const key of Object.keys(weights) as Array<keyof NormalizedFeatures>) {
      const diff = a[key] - b[key];
      sum += weights[key] * diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Update centroids based on cluster assignments
   */
  private updateCentroids(
    features: NormalizedFeatures[],
    clusters: number[],
    k: number
  ): NormalizedFeatures[] {
    const centroids: NormalizedFeatures[] = [];

    for (let i = 0; i < k; i++) {
      const clusterPoints = features.filter((_, idx) => clusters[idx] === i);

      if (clusterPoints.length === 0) {
        // If cluster is empty, reinitialize randomly
        centroids.push(features[Math.floor(Math.random() * features.length)]);
        continue;
      }

      const centroid: NormalizedFeatures = {
        roleHash: 0,
        categoryHash: 0,
        seniorityLevel: 0,
        serviceHash: 0,
        countryHash: 0,
        regionHash: 0,
        normalizedRate: 0,
        tierLevel: 0,
      };

      for (const point of clusterPoints) {
        for (const key of Object.keys(centroid) as Array<keyof NormalizedFeatures>) {
          centroid[key] += point[key];
        }
      }

      for (const key of Object.keys(centroid) as Array<keyof NormalizedFeatures>) {
        centroid[key] /= clusterPoints.length;
      }

      centroids.push(centroid);
    }

    return centroids;
  }

  /**
   * Calculate within-cluster sum of squares
   */
  private calculateWCSS(
    features: NormalizedFeatures[],
    clusters: number[],
    centroids: NormalizedFeatures[]
  ): number {
    let wcss = 0;

    for (let i = 0; i < features.length; i++) {
      const centroid = centroids[clusters[i]];
      const distance = this.euclideanDistance(features[i], centroid);
      wcss += distance * distance;
    }

    return wcss;
  }

  /**
   * Calculate total shift in centroids
   */
  private calculateCentroidShift(
    prev: NormalizedFeatures[],
    current: NormalizedFeatures[]
  ): number {
    let totalShift = 0;

    for (let i = 0; i < prev.length; i++) {
      totalShift += this.euclideanDistance(prev[i], current[i]);
    }

    return totalShift / prev.length;
  }

  /**
   * Calculate cluster characteristics
   */
  private calculateClusterCharacteristics(rateCards: any[]): ClusterCharacteristics {
    const rates = rateCards.map((rc) => parseFloat(rc.dailyRateUSD.toString()));
    const roles = rateCards.map((rc) => rc.roleStandardized);
    const geographies = rateCards.map((rc) => `${rc.country} - ${rc.region}`);
    const suppliers = new Set(rateCards.map((rc) => rc.supplierId));

    // Calculate rate statistics
    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);

    // Find most common roles (top 3)
    const roleCounts = this.countOccurrences(roles);
    const commonRoles = Object.entries(roleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([role]) => role);

    // Find most common geographies (top 3)
    const geoCounts = this.countOccurrences(geographies);
    const commonGeographies = Object.entries(geoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([geo]) => geo);

    // Calculate distributions
    const seniorityDistribution = this.countOccurrences(rateCards.map((rc) => rc.seniority));
    const serviceLineDistribution = this.countOccurrences(
      rateCards.map((rc) => rc.lineOfService)
    );

    return {
      avgRate,
      minRate,
      maxRate,
      rateRange: { min: minRate, max: maxRate },
      commonRoles,
      commonGeographies,
      supplierCount: suppliers.size,
      seniorityDistribution,
      serviceLineDistribution,
    };
  }

  /**
   * Count occurrences of items in an array
   */
  private countOccurrences(items: string[]): Record<string, number> {
    return items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Estimate consolidation savings for a cluster
   */
  private estimateConsolidationSavings(rateCards: any[]): number {
    if (rateCards.length < 2) return 0;

    const suppliers = new Set(rateCards.map((rc) => rc.supplierId));
    if (suppliers.size <= 1) return 0; // No consolidation opportunity

    const rates = rateCards.map((rc) => parseFloat(rc.dailyRateUSD.toString()));
    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    const minRate = Math.min(...rates);

    // Estimate savings: difference between average and minimum rate
    // Multiplied by estimated annual volume (assuming 200 days/year per resource)
    const savingsPerDay = avgRate - minRate;
    const estimatedAnnualDays = rateCards.length * 200;
    const potentialSavings = savingsPerDay * estimatedAnnualDays;

    // Apply discount factor based on supplier count (more suppliers = more opportunity)
    const supplierFactor = Math.min(suppliers.size / 5, 1);

    return potentialSavings * supplierFactor;
  }

  /**
   * Generate a descriptive name for the cluster
   */
  private generateClusterName(characteristics: ClusterCharacteristics): string {
    const primaryRole = characteristics.commonRoles[0] || 'Mixed Roles';
    const primaryGeo = characteristics.commonGeographies[0]?.split(' - ')[0] || 'Multi-Region';
    const rateLevel =
      characteristics.avgRate < 500
        ? 'Low-Cost'
        : characteristics.avgRate < 1000
        ? 'Mid-Range'
        : 'Premium';

    return `${rateLevel} ${primaryRole} - ${primaryGeo}`;
  }
}

export const rateCardClusteringService = new RateCardClusteringService();
