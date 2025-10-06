/**
 * Enterprise Event Bus
 * Handles event-driven communication between all system components
 */

import { EventEmitter } from 'events';

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  payload: any;
  metadata: {
    tenantId: string;
    userId?: string;
    sessionId?: string;
    correlationId: string;
    causationId?: string;
    source: string;
  };
}

export interface EventHandler {
  id: string;
  eventTypes: string[];
  handler: (event: DomainEvent) => Promise<void>;
  options: {
    retry: boolean;
    maxRetries: number;
    deadLetterQueue: boolean;
    timeout: number;
    priority: number;
  };
}

export interface EventSubscription {
  id: string;
  handlerId: string;
  eventPattern: string;
  active: boolean;
  createdAt: Date;
  lastProcessed?: Date;
  processedCount: number;
  errorCount: number;
}

export interface EventStore {
  append(events: DomainEvent[]): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getEventsByType(eventType: string, limit?: number): Promise<DomainEvent[]>;
  getEventStream(fromTimestamp: Date): AsyncIterable<DomainEvent>;
}

export interface EventProjection {
  id: string;
  name: string;
  eventTypes: string[];
  projectionHandler: (event: DomainEvent, currentState: any) => Promise<any>;
  state: any;
  lastProcessedEvent?: string;
  lastUpdated?: Date;
}

export class EventBus extends EventEmitter {
  private handlers = new Map<string, EventHandler>();
  private subscriptions = new Map<string, EventSubscription>();
  private projections = new Map<string, EventProjection>();
  private eventStore: EventStore;
  private deadLetterQueue: DomainEvent[] = [];
  private processingQueue: DomainEvent[] = [];
  private isProcessing = false;

  constructor(eventStore: EventStore) {
    super();
    this.eventStore = eventStore;
    this.startEventProcessing();
    this.startProjectionUpdates();
  }

  /**
   * Publish an event to the bus
   */
  async publish(event: Omit<DomainEvent, 'id' | 'timestamp'>): Promise<void> {
    const domainEvent: DomainEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event
    };

    // Store event
    await this.eventStore.append([domainEvent]);

    // Add to processing queue
    this.processingQueue.push(domainEvent);

    // Emit for immediate processing
    this.emit('event:published', domainEvent);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processEvents();
    }
  }

  /**
   * Publish multiple events as a batch
   */
  async publishBatch(events: Array<Omit<DomainEvent, 'id' | 'timestamp'>>): Promise<void> {
    const domainEvents: DomainEvent[] = events.map(event => ({
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event
    }));

    // Store events
    await this.eventStore.append(domainEvents);

    // Add to processing queue
    this.processingQueue.push(...domainEvents);

    // Emit batch published event
    this.emit('events:published', domainEvents);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processEvents();
    }
  }

  /**
   * Register an event handler
   */
  registerHandler(handler: EventHandler): void {
    this.handlers.set(handler.id, handler);

    // Create subscriptions for each event type
    handler.eventTypes.forEach(eventType => {
      const subscriptionId = `${handler.id}_${eventType}`;
      const subscription: EventSubscription = {
        id: subscriptionId,
        handlerId: handler.id,
        eventPattern: eventType,
        active: true,
        createdAt: new Date(),
        processedCount: 0,
        errorCount: 0
      };

      this.subscriptions.set(subscriptionId, subscription);
    });

    this.emit('handler:registered', handler);
  }

  /**
   * Unregister an event handler
   */
  unregisterHandler(handlerId: string): boolean {
    const handler = this.handlers.get(handlerId);
    if (!handler) return false;

    // Remove handler
    this.handlers.delete(handlerId);

    // Remove associated subscriptions
    for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
      if (subscription.handlerId === handlerId) {
        this.subscriptions.delete(subscriptionId);
      }
    }

    this.emit('handler:unregistered', handlerId);
    return true;
  }

  /**
   * Register an event projection
   */
  registerProjection(projection: EventProjection): void {
    this.projections.set(projection.id, projection);
    this.emit('projection:registered', projection);
  }

  /**
   * Unregister an event projection
   */
  unregisterProjection(projectionId: string): boolean {
    const removed = this.projections.delete(projectionId);
    if (removed) {
      this.emit('projection:unregistered', projectionId);
    }
    return removed;
  }

  /**
   * Get projection state
   */
  getProjectionState(projectionId: string): any {
    const projection = this.projections.get(projectionId);
    return projection ? projection.state : null;
  }

  /**
   * Replay events for a specific aggregate
   */
  async replayEvents(aggregateId: string, fromVersion = 0): Promise<DomainEvent[]> {
    const events = await this.eventStore.getEvents(aggregateId, fromVersion);
    
    // Re-process events through handlers
    for (const event of events) {
      await this.processEvent(event, true); // isReplay = true
    }

    this.emit('events:replayed', { aggregateId, eventCount: events.length });
    return events;
  }

  /**
   * Get event history for an aggregate
   */
  async getEventHistory(aggregateId: string): Promise<DomainEvent[]> {
    return await this.eventStore.getEvents(aggregateId);
  }

  /**
   * Get events by type
   */
  async getEventsByType(eventType: string, limit = 100): Promise<DomainEvent[]> {
    return await this.eventStore.getEventsByType(eventType, limit);
  }

  /**
   * Create event stream for real-time processing
   */
  async createEventStream(fromTimestamp: Date): Promise<AsyncIterable<DomainEvent>> {
    return this.eventStore.getEventStream(fromTimestamp);
  }

  /**
   * Process events from the queue
   */
  private async processEvents(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const event = this.processingQueue.shift()!;
        await this.processEvent(event);
      }
    } catch (error) {
      this.emit('processing:error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: DomainEvent, isReplay = false): Promise<void> {
    const matchingSubscriptions = this.getMatchingSubscriptions(event.type);

    // Process each matching subscription
    for (const subscription of matchingSubscriptions) {
      if (!subscription.active) continue;

      const handler = this.handlers.get(subscription.handlerId);
      if (!handler) continue;

      try {
        // Execute handler with timeout
        await this.executeHandlerWithTimeout(handler, event);
        
        // Update subscription metrics
        subscription.processedCount++;
        subscription.lastProcessed = new Date();

        this.emit('event:processed', { event, handler: handler.id });

      } catch (error) {
        subscription.errorCount++;
        
        this.emit('event:processing_failed', { 
          event, 
          handler: handler.id, 
          error: error.message 
        });

        // Handle retry logic
        if (handler.options.retry && subscription.errorCount <= handler.options.maxRetries) {
          // Re-queue for retry
          setTimeout(() => {
            this.processingQueue.push(event);
            if (!this.isProcessing) {
              this.processEvents();
            }
          }, this.calculateRetryDelay(subscription.errorCount));
        } else if (handler.options.deadLetterQueue) {
          // Send to dead letter queue
          this.deadLetterQueue.push(event);
          this.emit('event:dead_letter', { event, handler: handler.id });
        }
      }
    }

    // Update projections (only for non-replay events)
    if (!isReplay) {
      await this.updateProjections(event);
    }
  }

  /**
   * Execute handler with timeout
   */
  private async executeHandlerWithTimeout(handler: EventHandler, event: DomainEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Handler ${handler.id} timed out after ${handler.options.timeout}ms`));
      }, handler.options.timeout);

      handler.handler(event)
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Get subscriptions matching an event type
   */
  private getMatchingSubscriptions(eventType: string): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      if (this.matchesEventPattern(eventType, subscription.eventPattern)) {
        matching.push(subscription);
      }
    }

    // Sort by handler priority
    return matching.sort((a, b) => {
      const handlerA = this.handlers.get(a.handlerId);
      const handlerB = this.handlers.get(b.handlerId);
      return (handlerB?.options.priority || 0) - (handlerA?.options.priority || 0);
    });
  }

  /**
   * Check if event type matches pattern
   */
  private matchesEventPattern(eventType: string, pattern: string): boolean {
    // Support wildcards
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return eventType.startsWith(pattern.slice(0, -1));
    }
    return eventType === pattern;
  }

  /**
   * Update projections with new event
   */
  private async updateProjections(event: DomainEvent): Promise<void> {
    for (const projection of this.projections.values()) {
      if (projection.eventTypes.includes(event.type) || projection.eventTypes.includes('*')) {
        try {
          const newState = await projection.projectionHandler(event, projection.state);
          projection.state = newState;
          projection.lastProcessedEvent = event.id;
          projection.lastUpdated = new Date();

          this.emit('projection:updated', { projection: projection.id, event: event.id });
        } catch (error) {
          this.emit('projection:error', { 
            projection: projection.id, 
            event: event.id, 
            error: error.message 
          });
        }
      }
    }
  }

  /**
   * Start projection updates from event stream
   */
  private startProjectionUpdates(): void {
    // This would typically connect to a persistent event stream
    // For now, we'll just process events as they come through the bus
    this.on('event:published', async (event: DomainEvent) => {
      await this.updateProjections(event);
    });
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptNumber: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);
    
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Get bus statistics
   */
  getStatistics(): any {
    const handlerStats = Array.from(this.handlers.values()).map(handler => ({
      id: handler.id,
      eventTypes: handler.eventTypes,
      subscriptions: Array.from(this.subscriptions.values())
        .filter(sub => sub.handlerId === handler.id)
        .map(sub => ({
          id: sub.id,
          eventPattern: sub.eventPattern,
          processedCount: sub.processedCount,
          errorCount: sub.errorCount,
          lastProcessed: sub.lastProcessed
        }))
    }));

    const projectionStats = Array.from(this.projections.values()).map(projection => ({
      id: projection.id,
      name: projection.name,
      eventTypes: projection.eventTypes,
      lastProcessedEvent: projection.lastProcessedEvent,
      lastUpdated: projection.lastUpdated
    }));

    return {
      handlers: {
        total: this.handlers.size,
        details: handlerStats
      },
      subscriptions: {
        total: this.subscriptions.size,
        active: Array.from(this.subscriptions.values()).filter(s => s.active).length
      },
      projections: {
        total: this.projections.size,
        details: projectionStats
      },
      processing: {
        queueSize: this.processingQueue.length,
        deadLetterQueueSize: this.deadLetterQueue.length,
        isProcessing: this.isProcessing
      }
    };
  }

  /**
   * Get dead letter queue events
   */
  getDeadLetterQueue(): DomainEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Reprocess dead letter queue events
   */
  async reprocessDeadLetterQueue(): Promise<void> {
    const events = [...this.deadLetterQueue];
    this.deadLetterQueue.length = 0; // Clear the queue

    for (const event of events) {
      this.processingQueue.push(event);
    }

    if (!this.isProcessing) {
      await this.processEvents();
    }

    this.emit('dead_letter:reprocessed', { eventCount: events.length });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    return {
      status: 'healthy',
      handlers: this.handlers.size,
      subscriptions: this.subscriptions.size,
      projections: this.projections.size,
      queueSize: this.processingQueue.length,
      deadLetterQueueSize: this.deadLetterQueue.length,
      isProcessing: this.isProcessing,
      timestamp: new Date()
    };
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * In-Memory Event Store Implementation
 * In production, this would be replaced with a persistent store like EventStore, PostgreSQL, or MongoDB
 */
export class InMemoryEventStore implements EventStore {
  private events = new Map<string, DomainEvent[]>();
  private allEvents: DomainEvent[] = [];

  async append(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      // Store by aggregate
      if (!this.events.has(event.aggregateId)) {
        this.events.set(event.aggregateId, []);
      }
      this.events.get(event.aggregateId)!.push(event);
      
      // Store in global list
      this.allEvents.push(event);
    }

    // Sort by timestamp
    this.allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getEvents(aggregateId: string, fromVersion = 0): Promise<DomainEvent[]> {
    const aggregateEvents = this.events.get(aggregateId) || [];
    return aggregateEvents.filter(event => event.version >= fromVersion);
  }

  async getEventsByType(eventType: string, limit = 100): Promise<DomainEvent[]> {
    return this.allEvents
      .filter(event => event.type === eventType)
      .slice(-limit); // Get most recent events
  }

  async *getEventStream(fromTimestamp: Date): AsyncIterable<DomainEvent> {
    const events = this.allEvents.filter(event => event.timestamp >= fromTimestamp);
    
    for (const event of events) {
      yield event;
    }
  }
}

// Export singleton instances
export const eventStore = new InMemoryEventStore();
export const eventBus = new EventBus(eventStore);