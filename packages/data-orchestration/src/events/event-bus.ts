import { EventEmitter } from 'events';

/**
 * Event Bus - Central event system for data orchestration
 */

export enum Events {
  // Contract Events
  CONTRACT_CREATED = 'contract:created',
  CONTRACT_UPDATED = 'contract:updated',
  CONTRACT_DELETED = 'contract:deleted',
  CONTRACT_METADATA_UPDATED = 'contract:metadata:updated',
  
  // Artifact Events
  ARTIFACT_CREATED = 'artifact:created',
  ARTIFACT_UPDATED = 'artifact:updated',
  ARTIFACT_DELETED = 'artifact:deleted',
  ARTIFACT_VALIDATED = 'artifact:validated',
  ARTIFACT_GENERATED = 'artifact:generated',
  ARTIFACT_FIELD_UPDATED = 'artifact:field:updated',
  
  // Processing Events
  PROCESSING_STARTED = 'processing:started',
  PROCESSING_COMPLETED = 'processing:completed',
  PROCESSING_FAILED = 'processing:failed',
  
  // Job Events
  JOB_CREATED = 'job:created',
  JOB_PROGRESS = 'job:progress',
  JOB_STATUS_CHANGED = 'job:status:changed',
  JOB_ERROR = 'job:error',
  JOB_STALLED = 'job:stalled',
  
  // Metadata Events
  METADATA_UPDATED = 'metadata:updated',
  
  // Edit Events
  EDIT_CREATED = 'edit:created',
  EDIT_APPROVED = 'edit:approved',
  EDIT_REJECTED = 'edit:rejected',
  
  // Propagation Events
  PROPAGATION_STARTED = 'propagation:started',
  PROPAGATION_COMPLETED = 'propagation:completed',
  
  // Version Events
  VERSION_CREATED = 'version:created',
  
  // Cache Events
  CACHE_INVALIDATED = 'cache:invalidated',
  
  // Analytics Events
  ANALYTICS_UPDATED = 'analytics:updated',
  
  // Rate Card Events
  RATE_CARD_CREATED = 'ratecard:created',
  RATE_CARD_UPDATED = 'ratecard:updated',
  RATE_CARD_DELETED = 'ratecard:deleted',
  RATE_CARD_IMPORTED = 'ratecard:imported',
  
  // Benchmark Events
  BENCHMARK_CALCULATED = 'benchmark:calculated',
  BENCHMARK_INVALIDATED = 'benchmark:invalidated',
  BENCHMARK_RECALCULATING = 'benchmark:recalculating',
  
  // Market Events
  MARKET_SHIFT_DETECTED = 'market:shift:detected',
  BEST_RATE_CHANGED = 'market:bestrate:changed',
}

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100); // Increase max listeners for complex workflows
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Emit an event with data
   */
  public emit(event: Events | string, data?: any): boolean {
    return super.emit(event, data);
  }

  /**
   * Publish an event (alias for emit)
   */
  public publish(event: Events | string, data?: any): boolean {
    return this.emit(event, data);
  }

  /**
   * Listen to an event
   */
  public on(event: Events | string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  /**
   * Listen to an event once
   */
  public once(event: Events | string, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  /**
   * Remove a listener
   */
  public off(event: Events | string, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }

  /**
   * Remove all listeners for an event
   */
  public removeAllListeners(event?: Events | string): this {
    return super.removeAllListeners(event);
  }
}

export const eventBus = EventBus.getInstance();
