/**
 * Edge Computing and Distributed Processing
 * Federated contract processing with data locality
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface EdgeRegion {
  id: string;
  name: string;
  location: {
    country: string;
    region: string;
    coordinates: { lat: number; lng: number };
  };
  capabilities: {
    processing: 'low' | 'medium' | 'high';
    storage: 'low' | 'medium' | 'high';
    bandwidth: 'low' | 'medium' | 'high';
    aiAcceleration: boolean;
    compliance: string[]; // GDPR, CCPA, etc.
  };
  resources: {
    cpu: number; // cores
    memory: number; // GB
    storage: number; // GB
    gpu?: number; // count
  };
  status: 'active' | 'inactive' | 'maintenance' | 'overloaded';
  load: {
    cpu: number; // percentage
    memory: number; // percentage
    storage: number; // percentage
    activeJobs: number;
  };
  latency: {
    toCore: number; // ms
    toOtherRegions: Map<string, number>; // ms
  };
}

export interface ProcessingJob {
  id: string;
  tenantId: string;
  type: 'text_extraction' | 'ai_analysis' | 'vector_indexing' | 'graph_analysis';
  priority: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  requirements: {
    minCpu: number;
    minMemory: number;
    minStorage: number;
    requiresGpu?: boolean;
    dataLocality?: string[]; // preferred regions
    compliance?: string[]; // required compliance
    maxLatency?: number; // ms
  };
  constraints: {
    allowedRegions?: string[];
    forbiddenRegions?: string[];
    dataResidency?: string; // must stay in region
  };
  status: 'queued' | 'assigned' | 'processing' | 'completed' | 'failed';
  assignedRegion?: string;
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

export interface DataLocalityRule {
  id: string;
  tenantId: string;
  dataType: string;
  rules: {
    preferredRegions: string[];
    forbiddenRegions: string[];
    requiresEncryption: boolean;
    maxDistance: number; // km
    complianceRequirements: string[];
  };
}

export interface FederatedTask {
  id: string;
  parentJobId: string;
  subtasks: ProcessingJob[];
  aggregationStrategy: 'sum' | 'average' | 'consensus' | 'custom';
  synchronization: 'sync' | 'async' | 'eventual';
  status: 'pending' | 'executing' | 'aggregating' | 'completed' | 'failed';
}

export interface EdgeCache {
  regionId: string;
  entries: Map<string, CacheEntry>;
  maxSize: number; // MB
  currentSize: number; // MB
  hitRate: number;
  evictionPolicy: 'LRU' | 'LFU' | 'TTL';
}

export interface CacheEntry {
  key: string;
  data: any;
  size: number; // bytes
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  ttl?: number; // seconds
  tags: string[];
}

export interface LoadBalancingStrategy {
  name: 'round_robin' | 'least_loaded' | 'geographic' | 'capability_based' | 'cost_optimized';
  parameters: Record<string, any>;
}

export class EdgeProcessor extends EventEmitter {
  private regions = new Map<string, EdgeRegion>();
  private jobs = new Map<string, ProcessingJob>();
  private federatedTasks = new Map<string, FederatedTask>();
  private dataLocalityRules = new Map<string, DataLocalityRule>();
  private edgeCaches = new Map<string, EdgeCache>();
  private loadBalancer: LoadBalancer;
  private jobScheduler: JobScheduler;

  constructor() {
    super();
    this.loadBalancer = new LoadBalancer();
    this.jobScheduler = new JobScheduler();
    this.initializeRegions();
    this.startHealthMonitoring();
  }

  /**
   * Register new edge region
   */
  async registerRegion(region: Omit<EdgeRegion, 'id' | 'status' | 'load' | 'latency'>): Promise<EdgeRegion> {
    const edgeRegion: EdgeRegion = {
      id: crypto.randomUUID(),
      ...region,
      status: 'active',
      load: {
        cpu: 0,
        memory: 0,
        storage: 0,
        activeJobs: 0
      },
      latency: {
        toCore: 0,
        toOtherRegions: new Map()
      }
    };

    this.regions.set(edgeRegion.id, edgeRegion);
    
    // Initialize cache for region
    this.edgeCaches.set(edgeRegion.id, {
      regionId: edgeRegion.id,
      entries: new Map(),
      maxSize: Math.floor(edgeRegion.resources.memory * 0.3 * 1024), // 30% of memory in MB
      currentSize: 0,
      hitRate: 0,
      evictionPolicy: 'LRU'
    });

    // Measure latencies to other regions
    await this.measureLatencies(edgeRegion.id);

    this.emit('region:registered', edgeRegion);
    return edgeRegion;
  }

  /**
   * Submit processing job
   */
  async submitJob(job: Omit<ProcessingJob, 'id' | 'status'>): Promise<ProcessingJob> {
    const processingJob: ProcessingJob = {
      id: crypto.randomUUID(),
      ...job,
      status: 'queued'
    };

    this.jobs.set(processingJob.id, processingJob);

    // Find optimal region for processing
    const optimalRegion = await this.findOptimalRegion(processingJob);
    if (optimalRegion) {
      await this.assignJobToRegion(processingJob.id, optimalRegion.id);
    }

    this.emit('job:submitted', processingJob);
    return processingJob;
  }

  /**
   * Create federated processing task
   */
  async createFederatedTask(
    parentJobId: string,
    subtasks: Omit<ProcessingJob, 'id' | 'status'>[],
    aggregationStrategy: FederatedTask['aggregationStrategy'] = 'consensus',
    synchronization: FederatedTask['synchronization'] = 'sync'
  ): Promise<FederatedTask> {
    const federatedTask: FederatedTask = {
      id: crypto.randomUUID(),
      parentJobId,
      subtasks: [],
      aggregationStrategy,
      synchronization,
      status: 'pending'
    };

    // Create subtasks
    for (const subtaskData of subtasks) {
      const subtask = await this.submitJob(subtaskData);
      federatedTask.subtasks.push(subtask);
    }

    this.federatedTasks.set(federatedTask.id, federatedTask);

    // Start execution
    await this.executeFederatedTask(federatedTask.id);

    return federatedTask;
  }

  /**
   * Process contract with edge computing
   */
  async processContractDistributed(
    contractId: string,
    contractData: any,
    tenantId: string,
    processingOptions: {
      dataLocality?: string[];
      compliance?: string[];
      priority?: ProcessingJob['priority'];
      enableCaching?: boolean;
    } = {}
  ): Promise<{
    jobId: string;
    assignedRegions: string[];
    estimatedCompletionTime: number;
  }> {
    // Check cache first
    if (processingOptions.enableCaching) {
      const cachedResult = await this.checkDistributedCache(contractId, tenantId);
      if (cachedResult) {
        this.emit('contract:cache_hit', { contractId, tenantId });
        return cachedResult;
      }
    }

    // Create distributed processing pipeline
    const jobs: Omit<ProcessingJob, 'id' | 'status'>[] = [
      {
        tenantId,
        type: 'text_extraction',
        priority: processingOptions.priority || 'medium',
        data: { contractId, content: contractData.content },
        requirements: {
          minCpu: 2,
          minMemory: 4,
          minStorage: 1
        },
        constraints: {
          dataResidency: processingOptions.dataLocality?.[0]
        }
      },
      {
        tenantId,
        type: 'ai_analysis',
        priority: processingOptions.priority || 'medium',
        data: { contractId, extractedText: null }, // Will be filled by previous job
        requirements: {
          minCpu: 4,
          minMemory: 8,
          minStorage: 2,
          requiresGpu: true
        },
        constraints: {
          allowedRegions: processingOptions.dataLocality
        }
      },
      {
        tenantId,
        type: 'vector_indexing',
        priority: processingOptions.priority || 'medium',
        data: { contractId, analysis: null }, // Will be filled by previous job
        requirements: {
          minCpu: 2,
          minMemory: 4,
          minStorage: 5
        },
        constraints: {}
      },
      {
        tenantId,
        type: 'graph_analysis',
        priority: processingOptions.priority || 'medium',
        data: { contractId, vectors: null }, // Will be filled by previous job
        requirements: {
          minCpu: 4,
          minMemory: 8,
          minStorage: 2
        },
        constraints: {}
      }
    ];

    // Create federated task
    const federatedTask = await this.createFederatedTask(
      contractId,
      jobs,
      'consensus',
      'sync'
    );

    const assignedRegions = federatedTask.subtasks
      .map(job => job.assignedRegion)
      .filter(Boolean) as string[];

    const estimatedCompletionTime = this.estimateCompletionTime(federatedTask.subtasks);

    this.emit('contract:distributed_processing_started', {
      contractId,
      tenantId,
      federatedTaskId: federatedTask.id,
      assignedRegions
    });

    return {
      jobId: federatedTask.id,
      assignedRegions,
      estimatedCompletionTime
    };
  }

  /**
   * Get processing status across regions
   */
  async getDistributedStatus(jobId: string): Promise<{
    overallStatus: string;
    regionStatuses: Array<{
      regionId: string;
      regionName: string;
      status: string;
      progress: number;
      estimatedTimeRemaining: number;
    }>;
    aggregatedProgress: number;
  }> {
    const federatedTask = this.federatedTasks.get(jobId);
    if (!federatedTask) {
      throw new Error(`Federated task ${jobId} not found`);
    }

    const regionStatuses = federatedTask.subtasks.map(job => {
      const region = job.assignedRegion ? this.regions.get(job.assignedRegion) : null;
      return {
        regionId: job.assignedRegion || 'unassigned',
        regionName: region?.name || 'Unknown',
        status: job.status,
        progress: this.calculateJobProgress(job),
        estimatedTimeRemaining: this.estimateTimeRemaining(job)
      };
    });

    const aggregatedProgress = regionStatuses.reduce((sum, status) => sum + status.progress, 0) / regionStatuses.length;

    return {
      overallStatus: federatedTask.status,
      regionStatuses,
      aggregatedProgress
    };
  }

  /**
   * Optimize data placement across regions
   */
  async optimizeDataPlacement(tenantId: string): Promise<{
    recommendations: Array<{
      dataType: string;
      currentRegion: string;
      recommendedRegion: string;
      reason: string;
      estimatedImprovement: number;
    }>;
    migrationPlan: Array<{
      dataId: string;
      fromRegion: string;
      toRegion: string;
      priority: number;
      estimatedTime: number;
    }>;
  }> {
    const recommendations: any[] = [];
    const migrationPlan: any[] = [];

    // Analyze current data distribution
    const dataDistribution = await this.analyzeDataDistribution(tenantId);
    
    // Analyze access patterns
    const accessPatterns = await this.analyzeAccessPatterns(tenantId);

    // Generate recommendations based on access patterns and compliance
    for (const [dataType, distribution] of dataDistribution.entries()) {
      const accessPattern = accessPatterns.get(dataType);
      if (!accessPattern) continue;

      const optimalRegion = this.findOptimalDataRegion(distribution, accessPattern);
      if (optimalRegion && optimalRegion !== distribution.primaryRegion) {
        recommendations.push({
          dataType,
          currentRegion: distribution.primaryRegion,
          recommendedRegion: optimalRegion,
          reason: 'Improved access latency and compliance',
          estimatedImprovement: 0.3 // 30% improvement
        });

        // Add to migration plan
        migrationPlan.push({
          dataId: dataType,
          fromRegion: distribution.primaryRegion,
          toRegion: optimalRegion,
          priority: accessPattern.frequency > 100 ? 1 : 2,
          estimatedTime: distribution.size * 0.1 // 0.1 hours per GB
        });
      }
    }

    return { recommendations, migrationPlan };
  }

  // Private helper methods

  private initializeRegions(): void {
    // Initialize default regions
    const defaultRegions = [
      {
        name: 'US East',
        location: {
          country: 'US',
          region: 'us-east-1',
          coordinates: { lat: 39.0458, lng: -76.6413 }
        },
        capabilities: {
          processing: 'high' as const,
          storage: 'high' as const,
          bandwidth: 'high' as const,
          aiAcceleration: true,
          compliance: ['SOX', 'CCPA']
        },
        resources: {
          cpu: 64,
          memory: 256,
          storage: 10000,
          gpu: 8
        }
      },
      {
        name: 'EU West',
        location: {
          country: 'IE',
          region: 'eu-west-1',
          coordinates: { lat: 53.3498, lng: -6.2603 }
        },
        capabilities: {
          processing: 'high' as const,
          storage: 'high' as const,
          bandwidth: 'high' as const,
          aiAcceleration: true,
          compliance: ['GDPR']
        },
        resources: {
          cpu: 64,
          memory: 256,
          storage: 10000,
          gpu: 8
        }
      },
      {
        name: 'Asia Pacific',
        location: {
          country: 'SG',
          region: 'ap-southeast-1',
          coordinates: { lat: 1.3521, lng: 103.8198 }
        },
        capabilities: {
          processing: 'medium' as const,
          storage: 'medium' as const,
          bandwidth: 'medium' as const,
          aiAcceleration: false,
          compliance: ['PDPA']
        },
        resources: {
          cpu: 32,
          memory: 128,
          storage: 5000
        }
      }
    ];

    defaultRegions.forEach(async (regionData) => {
      await this.registerRegion(regionData);
    });
  }

  private async measureLatencies(regionId: string): Promise<void> {
    const region = this.regions.get(regionId);
    if (!region) return;

    // Simulate latency measurements
    region.latency.toCore = Math.random() * 100 + 50; // 50-150ms

    for (const [otherId, otherRegion] of this.regions.entries()) {
      if (otherId !== regionId) {
        const distance = this.calculateDistance(
          region.location.coordinates,
          otherRegion.location.coordinates
        );
        const latency = Math.max(distance / 200, 10); // Rough latency calculation
        region.latency.toOtherRegions.set(otherId, latency);
      }
    }
  }

  private calculateDistance(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async findOptimalRegion(job: ProcessingJob): Promise<EdgeRegion | null> {
    const candidateRegions = Array.from(this.regions.values()).filter(region => {
      // Check basic availability
      if (region.status !== 'active') return false;

      // Check resource requirements
      if (region.resources.cpu < job.requirements.minCpu) return false;
      if (region.resources.memory < job.requirements.minMemory) return false;
      if (region.resources.storage < job.requirements.minStorage) return false;
      if (job.requirements.requiresGpu && !region.resources.gpu) return false;

      // Check constraints
      if (job.constraints.allowedRegions && !job.constraints.allowedRegions.includes(region.id)) return false;
      if (job.constraints.forbiddenRegions && job.constraints.forbiddenRegions.includes(region.id)) return false;

      // Check compliance requirements
      if (job.requirements.compliance) {
        const hasAllCompliance = job.requirements.compliance.every(req =>
          region.capabilities.compliance.includes(req)
        );
        if (!hasAllCompliance) return false;
      }

      return true;
    });

    if (candidateRegions.length === 0) return null;

    // Score regions based on multiple factors
    const scoredRegions = candidateRegions.map(region => ({
      region,
      score: this.calculateRegionScore(region, job)
    }));

    // Sort by score (highest first)
    scoredRegions.sort((a, b) => b.score - a.score);

    return scoredRegions[0].region;
  }

  private calculateRegionScore(region: EdgeRegion, job: ProcessingJob): number {
    let score = 0;

    // Resource availability score (0-40 points)
    const cpuAvailability = (region.resources.cpu - region.load.cpu * region.resources.cpu / 100) / region.resources.cpu;
    const memoryAvailability = (region.resources.memory - region.load.memory * region.resources.memory / 100) / region.resources.memory;
    score += (cpuAvailability + memoryAvailability) * 20;

    // Latency score (0-30 points)
    const maxLatency = job.requirements.maxLatency || 1000;
    const latencyScore = Math.max(0, (maxLatency - region.latency.toCore) / maxLatency);
    score += latencyScore * 30;

    // Capability match score (0-20 points)
    if (region.capabilities.processing === 'high') score += 10;
    if (region.capabilities.aiAcceleration && job.requirements.requiresGpu) score += 10;

    // Load balancing score (0-10 points)
    const loadScore = Math.max(0, (100 - region.load.cpu - region.load.memory) / 200);
    score += loadScore * 10;

    return score;
  }

  private async assignJobToRegion(jobId: string, regionId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    const region = this.regions.get(regionId);

    if (!job || !region) {
      throw new Error('Job or region not found');
    }

    job.assignedRegion = regionId;
    job.status = 'assigned';

    // Update region load
    region.load.activeJobs++;
    region.load.cpu += (job.requirements.minCpu / region.resources.cpu) * 100;
    region.load.memory += (job.requirements.minMemory / region.resources.memory) * 100;

    // Start processing
    await this.startJobProcessing(jobId);

    this.emit('job:assigned', { jobId, regionId });
  }

  private async startJobProcessing(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    job.startTime = new Date();

    // Simulate processing
    setTimeout(async () => {
      await this.completeJob(jobId);
    }, this.estimateProcessingTime(job));

    this.emit('job:started', job);
  }

  private async completeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'completed';
    job.endTime = new Date();
    job.result = this.generateMockResult(job);

    // Update region load
    if (job.assignedRegion) {
      const region = this.regions.get(job.assignedRegion);
      if (region) {
        region.load.activeJobs--;
        region.load.cpu -= (job.requirements.minCpu / region.resources.cpu) * 100;
        region.load.memory -= (job.requirements.minMemory / region.resources.memory) * 100;
      }
    }

    this.emit('job:completed', job);
  }

  private async executeFederatedTask(taskId: string): Promise<void> {
    const task = this.federatedTasks.get(taskId);
    if (!task) return;

    task.status = 'executing';

    // Wait for all subtasks to complete
    const completionPromises = task.subtasks.map(job => 
      new Promise<void>((resolve) => {
        const checkCompletion = () => {
          if (job.status === 'completed' || job.status === 'failed') {
            resolve();
          } else {
            setTimeout(checkCompletion, 1000);
          }
        };
        checkCompletion();
      })
    );

    await Promise.all(completionPromises);

    // Aggregate results
    task.status = 'aggregating';
    const aggregatedResult = await this.aggregateResults(task);

    task.status = 'completed';
    this.emit('federated_task:completed', { taskId, result: aggregatedResult });
  }

  private async aggregateResults(task: FederatedTask): Promise<any> {
    const results = task.subtasks
      .filter(job => job.status === 'completed')
      .map(job => job.result);

    switch (task.aggregationStrategy) {
      case 'consensus':
        return this.consensusAggregation(results);
      case 'average':
        return this.averageAggregation(results);
      case 'sum':
        return this.sumAggregation(results);
      default:
        return results[0]; // Return first result as fallback
    }
  }

  private consensusAggregation(results: any[]): any {
    // Simple majority consensus
    const resultCounts = new Map();
    results.forEach(result => {
      const key = JSON.stringify(result);
      resultCounts.set(key, (resultCounts.get(key) || 0) + 1);
    });

    let maxCount = 0;
    let consensusResult = null;
    for (const [result, count] of resultCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        consensusResult = JSON.parse(result);
      }
    }

    return consensusResult;
  }

  private averageAggregation(results: any[]): any {
    // Average numeric results
    if (results.length === 0) return null;
    
    const averaged = {};
    const firstResult = results[0];
    
    for (const key in firstResult) {
      if (typeof firstResult[key] === 'number') {
        averaged[key] = results.reduce((sum, result) => sum + (result[key] || 0), 0) / results.length;
      } else {
        averaged[key] = firstResult[key]; // Keep first non-numeric value
      }
    }

    return averaged;
  }

  private sumAggregation(results: any[]): any {
    // Sum numeric results
    if (results.length === 0) return null;
    
    const summed = {};
    const firstResult = results[0];
    
    for (const key in firstResult) {
      if (typeof firstResult[key] === 'number') {
        summed[key] = results.reduce((sum, result) => sum + (result[key] || 0), 0);
      } else {
        summed[key] = firstResult[key]; // Keep first non-numeric value
      }
    }

    return summed;
  }

  private estimateProcessingTime(job: ProcessingJob): number {
    const baseTime = {
      text_extraction: 5000,
      ai_analysis: 15000,
      vector_indexing: 8000,
      graph_analysis: 12000
    };

    return baseTime[job.type] || 10000;
  }

  private estimateCompletionTime(jobs: ProcessingJob[]): number {
    return jobs.reduce((total, job) => total + this.estimateProcessingTime(job), 0);
  }

  private calculateJobProgress(job: ProcessingJob): number {
    if (job.status === 'completed') return 100;
    if (job.status === 'failed') return 0;
    if (job.status === 'queued') return 0;
    if (job.status === 'assigned') return 10;
    
    // For processing jobs, estimate based on elapsed time
    if (job.startTime) {
      const elapsed = Date.now() - job.startTime.getTime();
      const estimated = this.estimateProcessingTime(job);
      return Math.min(90, 10 + (elapsed / estimated) * 80);
    }

    return 0;
  }

  private estimateTimeRemaining(job: ProcessingJob): number {
    if (job.status === 'completed' || job.status === 'failed') return 0;
    
    const totalTime = this.estimateProcessingTime(job);
    const progress = this.calculateJobProgress(job);
    
    return Math.max(0, totalTime * (100 - progress) / 100);
  }

  private generateMockResult(job: ProcessingJob): any {
    const baseResult = {
      jobId: job.id,
      processedAt: new Date(),
      processingRegion: job.assignedRegion
    };

    switch (job.type) {
      case 'text_extraction':
        return {
          ...baseResult,
          extractedText: 'Sample extracted text from contract...',
          wordCount: 1250,
          confidence: 0.95
        };
      
      case 'ai_analysis':
        return {
          ...baseResult,
          financial: { totalValue: 150000, currency: 'USD' },
          risk: { riskScore: 65, riskLevel: 'MEDIUM' },
          compliance: { complianceScore: 85 }
        };
      
      case 'vector_indexing':
        return {
          ...baseResult,
          vectorCount: 384,
          indexSize: 1024,
          searchReady: true
        };
      
      case 'graph_analysis':
        return {
          ...baseResult,
          nodeCount: 25,
          edgeCount: 45,
          clusters: 3
        };
      
      default:
        return baseResult;
    }
  }

  private async checkDistributedCache(contractId: string, tenantId: string): Promise<any> {
    // Check caches across regions
    for (const [regionId, cache] of this.edgeCaches.entries()) {
      const cacheKey = `${tenantId}:${contractId}`;
      const entry = cache.entries.get(cacheKey);
      
      if (entry && this.isCacheEntryValid(entry)) {
        // Update access statistics
        entry.lastAccessed = new Date();
        entry.accessCount++;
        
        this.emit('cache:hit', { regionId, cacheKey });
        return entry.data;
      }
    }

    return null;
  }

  private isCacheEntryValid(entry: CacheEntry): boolean {
    if (entry.ttl) {
      const age = (Date.now() - entry.createdAt.getTime()) / 1000;
      return age < entry.ttl;
    }
    return true;
  }

  private async analyzeDataDistribution(tenantId: string): Promise<Map<string, any>> {
    // Mock data distribution analysis
    return new Map([
      ['contracts', { primaryRegion: 'us-east-1', size: 100, accessFrequency: 150 }],
      ['analysis', { primaryRegion: 'eu-west-1', size: 50, accessFrequency: 80 }]
    ]);
  }

  private async analyzeAccessPatterns(tenantId: string): Promise<Map<string, any>> {
    // Mock access pattern analysis
    return new Map([
      ['contracts', { frequency: 150, regions: ['us-east-1', 'eu-west-1'], peakHours: [9, 17] }],
      ['analysis', { frequency: 80, regions: ['eu-west-1'], peakHours: [10, 16] }]
    ]);
  }

  private findOptimalDataRegion(distribution: any, accessPattern: any): string {
    // Simple optimization: place data in region with highest access
    const regionAccess = new Map();
    
    accessPattern.regions.forEach(region => {
      regionAccess.set(region, (regionAccess.get(region) || 0) + accessPattern.frequency);
    });

    let maxAccess = 0;
    let optimalRegion = distribution.primaryRegion;
    
    for (const [region, access] of regionAccess.entries()) {
      if (access > maxAccess) {
        maxAccess = access;
        optimalRegion = region;
      }
    }

    return optimalRegion;
  }

  private startHealthMonitoring(): void {
    setInterval(() => {
      this.updateRegionHealth();
    }, 30000); // Every 30 seconds
  }

  private updateRegionHealth(): void {
    for (const region of this.regions.values()) {
      // Simulate load fluctuations
      region.load.cpu += (Math.random() - 0.5) * 10;
      region.load.memory += (Math.random() - 0.5) * 10;
      
      // Clamp values
      region.load.cpu = Math.max(0, Math.min(100, region.load.cpu));
      region.load.memory = Math.max(0, Math.min(100, region.load.memory));

      // Update status based on load
      if (region.load.cpu > 90 || region.load.memory > 90) {
        region.status = 'overloaded';
      } else {
        region.status = 'active';
      }
    }

    this.emit('health:updated', {
      timestamp: new Date(),
      regionCount: this.regions.size,
      activeRegions: Array.from(this.regions.values()).filter(r => r.status === 'active').length
    });
  }

  // Public API methods

  getRegions(): EdgeRegion[] {
    return Array.from(this.regions.values());
  }

  getRegionStats(): {
    totalRegions: number;
    activeRegions: number;
    totalJobs: number;
    completedJobs: number;
    averageLatency: number;
    totalCapacity: { cpu: number; memory: number; storage: number };
  } {
    const regions = Array.from(this.regions.values());
    const jobs = Array.from(this.jobs.values());

    const totalCapacity = regions.reduce(
      (acc, region) => ({
        cpu: acc.cpu + region.resources.cpu,
        memory: acc.memory + region.resources.memory,
        storage: acc.storage + region.resources.storage
      }),
      { cpu: 0, memory: 0, storage: 0 }
    );

    const averageLatency = regions.reduce((sum, region) => sum + region.latency.toCore, 0) / regions.length;

    return {
      totalRegions: regions.length,
      activeRegions: regions.filter(r => r.status === 'active').length,
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      averageLatency,
      totalCapacity
    };
  }
}

// Helper classes
class LoadBalancer {
  balance(regions: EdgeRegion[], strategy: LoadBalancingStrategy): EdgeRegion | null {
    const activeRegions = regions.filter(r => r.status === 'active');
    if (activeRegions.length === 0) return null;

    switch (strategy.name) {
      case 'least_loaded':
        return activeRegions.reduce((min, region) => 
          region.load.cpu < min.load.cpu ? region : min
        );
      
      case 'round_robin':
        // Simple round-robin implementation
        const index = (strategy.parameters.counter || 0) % activeRegions.length;
        strategy.parameters.counter = index + 1;
        return activeRegions[index];
      
      default:
        return activeRegions[0];
    }
  }
}

class JobScheduler {
  schedule(jobs: ProcessingJob[], regions: EdgeRegion[]): Map<string, string> {
    const assignments = new Map<string, string>();
    
    // Simple priority-based scheduling
    const sortedJobs = jobs
      .filter(job => job.status === 'queued')
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    for (const job of sortedJobs) {
      const suitableRegions = regions.filter(region => 
        region.status === 'active' &&
        region.resources.cpu >= job.requirements.minCpu &&
        region.resources.memory >= job.requirements.minMemory
      );

      if (suitableRegions.length > 0) {
        // Assign to least loaded suitable region
        const bestRegion = suitableRegions.reduce((min, region) => 
          region.load.cpu < min.load.cpu ? region : min
        );
        assignments.set(job.id, bestRegion.id);
      }
    }

    return assignments;
  }
}

// Export singleton instance
export const edgeProcessor = new EdgeProcessor();