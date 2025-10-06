/**
 * Auto-Scaling and Load Management Service
 * Manages automatic scaling of workers and load balancing
 */

import { EventEmitter } from 'events';

export interface WorkerInstance {
  id: string;
  type: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  startTime: Date;
  lastActivity: Date;
  processedJobs: number;
  currentLoad: number;
  maxCapacity: number;
  healthScore: number;
  metadata: {
    version: string;
    resources: {
      cpu: number;
      memory: number;
    };
  };
}

export interface ScalingRule {
  id: string;
  workerType: string;
  metric: 'queue_depth' | 'cpu_usage' | 'memory_usage' | 'response_time' | 'error_rate';
  threshold: {
    scaleUp: number;
    scaleDown: number;
  };
  actions: {
    scaleUp: {
      increment: number;
      maxInstances: number;
      cooldown: number; // seconds
    };
    scaleDown: {
      decrement: number;
      minInstances: number;
      cooldown: number; // seconds
    };
  };
  enabled: boolean;
}

export interface LoadBalancerConfig {
  algorithm: 'round_robin' | 'least_connections' | 'weighted' | 'health_based';
  healthCheckInterval: number;
  failureThreshold: number;
  recoveryThreshold: number;
}

export interface SystemMetrics {
  timestamp: Date;
  queueDepth: Record<string, number>;
  workerUtilization: Record<string, number>;
  responseTime: number;
  errorRate: number;
  throughput: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

export class AutoScalingService extends EventEmitter {
  private workers = new Map<string, WorkerInstance>();
  private scalingRules = new Map<string, ScalingRule>();
  private loadBalancerConfig: LoadBalancerConfig;
  private metricsHistory: SystemMetrics[] = [];
  private lastScalingActions = new Map<string, Date>();
  private jobQueues = new Map<string, any[]>();

  constructor() {
    super();
    this.loadBalancerConfig = {
      algorithm: 'health_based',
      healthCheckInterval: 30000,
      failureThreshold: 3,
      recoveryThreshold: 2
    };
    
    this.setupDefaultScalingRules();
    this.startMetricsCollection();
    this.startHealthChecks();
    this.startAutoScaling();
  }

  /**
   * Register a worker instance
   */
  registerWorker(
    type: string,
    metadata: {
      version: string;
      resources: { cpu: number; memory: number };
    }
  ): string {
    const worker: WorkerInstance = {
      id: this.generateWorkerId(),
      type,
      status: 'starting',
      startTime: new Date(),
      lastActivity: new Date(),
      processedJobs: 0,
      currentLoad: 0,
      maxCapacity: 100,
      healthScore: 100,
      metadata
    };

    this.workers.set(worker.id, worker);
    this.emit('worker:registered', worker);

    // Mark as running after startup delay
    setTimeout(() => {
      worker.status = 'running';
      this.emit('worker:started', worker);
    }, 2000);

    return worker.id;
  }

  /**
   * Unregister a worker instance
   */
  unregisterWorker(workerId: string): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return false;
    }

    worker.status = 'stopping';
    this.emit('worker:stopping', worker);

    // Remove after graceful shutdown
    setTimeout(() => {
      this.workers.delete(workerId);
      this.emit('worker:removed', worker);
    }, 5000);

    return true;
  }

  /**
   * Update worker status
   */
  updateWorkerStatus(
    workerId: string,
    status: {
      currentLoad?: number;
      processedJobs?: number;
      healthScore?: number;
    }
  ): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return false;
    }

    if (status.currentLoad !== undefined) {
      worker.currentLoad = status.currentLoad;
    }
    if (status.processedJobs !== undefined) {
      worker.processedJobs = status.processedJobs;
    }
    if (status.healthScore !== undefined) {
      worker.healthScore = status.healthScore;
    }

    worker.lastActivity = new Date();
    this.emit('worker:updated', worker);

    return true;
  }

  /**
   * Add scaling rule
   */
  addScalingRule(rule: ScalingRule): void {
    this.scalingRules.set(rule.id, rule);
    this.emit('scaling:rule_added', rule);
  }

  /**
   * Remove scaling rule
   */
  removeScalingRule(ruleId: string): boolean {
    const rule = this.scalingRules.get(ruleId);
    if (!rule) {
      return false;
    }

    this.scalingRules.delete(ruleId);
    this.emit('scaling:rule_removed', rule);
    return true;
  }

  /**
   * Get next available worker for job assignment
   */
  getNextWorker(workerType: string): WorkerInstance | null {
    const availableWorkers = Array.from(this.workers.values())
      .filter(w => 
        w.type === workerType &&
        w.status === 'running' &&
        w.currentLoad < w.maxCapacity &&
        w.healthScore > 50
      );

    if (availableWorkers.length === 0) {
      return null;
    }

    return this.selectWorkerByAlgorithm(availableWorkers);
  }

  /**
   * Add job to queue
   */
  addJobToQueue(workerType: string, job: any): void {
    if (!this.jobQueues.has(workerType)) {
      this.jobQueues.set(workerType, []);
    }

    this.jobQueues.get(workerType)!.push(job);
    this.emit('job:queued', workerType, job);
  }

  /**
   * Get queue depth for worker type
   */
  getQueueDepth(workerType: string): number {
    return this.jobQueues.get(workerType)?.length || 0;
  }

  /**
   * Process job queue
   */
  processJobQueue(workerType: string): void {
    const queue = this.jobQueues.get(workerType);
    if (!queue || queue.length === 0) {
      return;
    }

    const worker = this.getNextWorker(workerType);
    if (!worker) {
      return; // No available workers
    }

    const job = queue.shift()!;
    this.assignJobToWorker(worker.id, job);
  }

  /**
   * Assign job to specific worker
   */
  assignJobToWorker(workerId: string, job: any): boolean {
    const worker = this.workers.get(workerId);
    if (!worker || worker.status !== 'running') {
      return false;
    }

    worker.currentLoad = Math.min(worker.currentLoad + 10, worker.maxCapacity);
    worker.lastActivity = new Date();

    this.emit('job:assigned', workerId, job);
    return true;
  }

  /**
   * Complete job on worker
   */
  completeJob(workerId: string, job: any): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return false;
    }

    worker.currentLoad = Math.max(worker.currentLoad - 10, 0);
    worker.processedJobs++;
    worker.lastActivity = new Date();

    this.emit('job:completed', workerId, job);
    return true;
  }

  /**
   * Get scaling statistics
   */
  getScalingStats(): {
    workersByType: Record<string, number>;
    totalWorkers: number;
    activeWorkers: number;
    queueDepths: Record<string, number>;
    averageLoad: number;
    scalingActions: Array<{
      timestamp: Date;
      action: string;
      workerType: string;
      reason: string;
    }>;
  } {
    const workersByType: Record<string, number> = {};
    let totalLoad = 0;
    let activeWorkers = 0;

    for (const worker of this.workers.values()) {
      workersByType[worker.type] = (workersByType[worker.type] || 0) + 1;
      
      if (worker.status === 'running') {
        activeWorkers++;
        totalLoad += worker.currentLoad;
      }
    }

    const queueDepths: Record<string, number> = {};
    for (const [type, queue] of this.jobQueues.entries()) {
      queueDepths[type] = queue.length;
    }

    return {
      workersByType,
      totalWorkers: this.workers.size,
      activeWorkers,
      queueDepths,
      averageLoad: activeWorkers > 0 ? totalLoad / activeWorkers : 0,
      scalingActions: [] // Would be populated from actual scaling history
    };
  }

  /**
   * Force scale up workers
   */
  async scaleUp(workerType: string, count: number): Promise<boolean> {
    try {
      for (let i = 0; i < count; i++) {
        await this.createWorkerInstance(workerType);
      }
      
      this.emit('scaling:manual_scale_up', workerType, count);
      return true;
    } catch (error) {
      this.emit('scaling:error', error);
      return false;
    }
  }

  /**
   * Force scale down workers
   */
  async scaleDown(workerType: string, count: number): Promise<boolean> {
    const workersToRemove = Array.from(this.workers.values())
      .filter(w => w.type === workerType && w.status === 'running')
      .sort((a, b) => a.currentLoad - b.currentLoad) // Remove least loaded first
      .slice(0, count);

    for (const worker of workersToRemove) {
      this.unregisterWorker(worker.id);
    }

    this.emit('scaling:manual_scale_down', workerType, count);
    return true;
  }

  // Private helper methods

  private setupDefaultScalingRules(): void {
    // Queue depth based scaling
    this.addScalingRule({
      id: 'queue_depth_text_extraction',
      workerType: 'text_extraction',
      metric: 'queue_depth',
      threshold: {
        scaleUp: 10,
        scaleDown: 2
      },
      actions: {
        scaleUp: {
          increment: 2,
          maxInstances: 10,
          cooldown: 300
        },
        scaleDown: {
          decrement: 1,
          minInstances: 1,
          cooldown: 600
        }
      },
      enabled: true
    });

    // CPU usage based scaling
    this.addScalingRule({
      id: 'cpu_usage_financial_analysis',
      workerType: 'financial_analysis',
      metric: 'cpu_usage',
      threshold: {
        scaleUp: 80,
        scaleDown: 30
      },
      actions: {
        scaleUp: {
          increment: 1,
          maxInstances: 5,
          cooldown: 180
        },
        scaleDown: {
          decrement: 1,
          minInstances: 1,
          cooldown: 300
        }
      },
      enabled: true
    });
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      const metrics = this.collectSystemMetrics();
      this.metricsHistory.push(metrics);
      
      // Keep only last 100 metrics
      if (this.metricsHistory.length > 100) {
        this.metricsHistory.shift();
      }
      
      this.emit('metrics:collected', metrics);
    }, 30000); // Collect every 30 seconds
  }

  private startHealthChecks(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, this.loadBalancerConfig.healthCheckInterval);
  }

  private startAutoScaling(): void {
    setInterval(() => {
      this.evaluateScalingRules();
    }, 60000); // Evaluate every minute
  }

  private collectSystemMetrics(): SystemMetrics {
    const queueDepth: Record<string, number> = {};
    const workerUtilization: Record<string, number> = {};

    // Collect queue depths
    for (const [type, queue] of this.jobQueues.entries()) {
      queueDepth[type] = queue.length;
    }

    // Collect worker utilization
    const workersByType = new Map<string, WorkerInstance[]>();
    for (const worker of this.workers.values()) {
      if (!workersByType.has(worker.type)) {
        workersByType.set(worker.type, []);
      }
      workersByType.get(worker.type)!.push(worker);
    }

    for (const [type, workers] of workersByType.entries()) {
      const activeWorkers = workers.filter(w => w.status === 'running');
      if (activeWorkers.length > 0) {
        const totalLoad = activeWorkers.reduce((sum, w) => sum + w.currentLoad, 0);
        workerUtilization[type] = totalLoad / (activeWorkers.length * 100) * 100;
      } else {
        workerUtilization[type] = 0;
      }
    }

    return {
      timestamp: new Date(),
      queueDepth,
      workerUtilization,
      responseTime: 150 + Math.random() * 100, // Mock response time
      errorRate: Math.random() * 5, // Mock error rate
      throughput: 50 + Math.random() * 20, // Mock throughput
      resourceUsage: {
        cpu: 40 + Math.random() * 30,
        memory: 60 + Math.random() * 20,
        disk: 30 + Math.random() * 10
      }
    };
  }

  private performHealthChecks(): void {
    for (const worker of this.workers.values()) {
      if (worker.status === 'running') {
        const timeSinceActivity = Date.now() - worker.lastActivity.getTime();
        
        if (timeSinceActivity > 300000) { // 5 minutes
          worker.healthScore = Math.max(worker.healthScore - 10, 0);
        } else {
          worker.healthScore = Math.min(worker.healthScore + 5, 100);
        }

        // Mark as error if health is too low
        if (worker.healthScore < 20) {
          worker.status = 'error';
          this.emit('worker:unhealthy', worker);
        }
      }
    }
  }

  private evaluateScalingRules(): void {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    if (!currentMetrics) return;

    for (const rule of this.scalingRules.values()) {
      if (!rule.enabled) continue;

      const lastAction = this.lastScalingActions.get(rule.id);
      const now = new Date();

      // Check cooldown
      if (lastAction) {
        const timeSinceLastAction = (now.getTime() - lastAction.getTime()) / 1000;
        if (timeSinceLastAction < Math.min(rule.actions.scaleUp.cooldown, rule.actions.scaleDown.cooldown)) {
          continue;
        }
      }

      const currentValue = this.getMetricValue(rule.metric, rule.workerType, currentMetrics);
      const currentWorkerCount = this.getWorkerCount(rule.workerType);

      // Check scale up condition
      if (currentValue > rule.threshold.scaleUp && 
          currentWorkerCount < rule.actions.scaleUp.maxInstances) {
        
        this.executeScaleUp(rule);
        this.lastScalingActions.set(rule.id, now);
      }
      // Check scale down condition
      else if (currentValue < rule.threshold.scaleDown && 
               currentWorkerCount > rule.actions.scaleDown.minInstances) {
        
        this.executeScaleDown(rule);
        this.lastScalingActions.set(rule.id, now);
      }
    }
  }

  private getMetricValue(metric: string, workerType: string, metrics: SystemMetrics): number {
    switch (metric) {
      case 'queue_depth':
        return metrics.queueDepth[workerType] || 0;
      case 'cpu_usage':
        return metrics.workerUtilization[workerType] || 0;
      case 'memory_usage':
        return metrics.resourceUsage.memory;
      case 'response_time':
        return metrics.responseTime;
      case 'error_rate':
        return metrics.errorRate;
      default:
        return 0;
    }
  }

  private getWorkerCount(workerType: string): number {
    return Array.from(this.workers.values())
      .filter(w => w.type === workerType && w.status === 'running').length;
  }

  private async executeScaleUp(rule: ScalingRule): Promise<void> {
    try {
      for (let i = 0; i < rule.actions.scaleUp.increment; i++) {
        await this.createWorkerInstance(rule.workerType);
      }
      
      this.emit('scaling:auto_scale_up', rule);
    } catch (error) {
      this.emit('scaling:error', error);
    }
  }

  private executeScaleDown(rule: ScalingRule): void {
    const workersToRemove = Array.from(this.workers.values())
      .filter(w => w.type === rule.workerType && w.status === 'running')
      .sort((a, b) => a.currentLoad - b.currentLoad)
      .slice(0, rule.actions.scaleDown.decrement);

    for (const worker of workersToRemove) {
      this.unregisterWorker(worker.id);
    }

    this.emit('scaling:auto_scale_down', rule);
  }

  private async createWorkerInstance(workerType: string): Promise<string> {
    // Simulate worker creation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return this.registerWorker(workerType, {
      version: '1.0.0',
      resources: { cpu: 2, memory: 4096 }
    });
  }

  private selectWorkerByAlgorithm(workers: WorkerInstance[]): WorkerInstance {
    switch (this.loadBalancerConfig.algorithm) {
      case 'round_robin':
        return workers[Math.floor(Math.random() * workers.length)];
      
      case 'least_connections':
        return workers.reduce((min, worker) => 
          worker.currentLoad < min.currentLoad ? worker : min
        );
      
      case 'weighted':
        // Weight by inverse of current load
        const weights = workers.map(w => 1 / (w.currentLoad + 1));
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const random = Math.random() * totalWeight;
        
        let currentWeight = 0;
        for (let i = 0; i < workers.length; i++) {
          currentWeight += weights[i];
          if (random <= currentWeight) {
            return workers[i];
          }
        }
        return workers[0];
      
      case 'health_based':
        return workers.reduce((best, worker) => 
          worker.healthScore > best.healthScore ? worker : best
        );
      
      default:
        return workers[0];
    }
  }

  private generateWorkerId(): string {
    return `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const autoScalingService = new AutoScalingService();