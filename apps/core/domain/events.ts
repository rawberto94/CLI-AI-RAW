/**
 * Domain Events for Event-Driven Architecture
 * Core event system with CQRS pattern implementation
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  payload: any;
  metadata: {
    timestamp: Date;
    userId?: string;
    tenantId: string;
    correlationId: string;
    causationId?: string;
    source: string;
  };
  sequence: number;
}

export interface EventStore {
  append(events: DomainEvent[]): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getEventsByType(eventType: string, fromTimestamp?: Date): Promise<DomainEvent[]>;
  subscribe(eventType: string, handler: EventHandler): void;
}

export interface EventHandler {
  handle(event: DomainEvent): Promise<void>;
}

export interface Command {
  id: string;
  type: string;
  aggregateId: string;
  payload: any;
  metadata: {
    userId?: string;
    tenantId: string;
    timestamp: Date;
  };
}

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<DomainEvent[]>;
}

export class InMemoryEventStore implements EventStore {
  private events = new Map<string, DomainEvent[]>();
  private globalEvents: DomainEvent[] = [];
  private subscribers = new Map<string, EventHandler[]>();
  private eventEmitter = new EventEmitter();

  async append(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      // Store by aggregate
      if (!this.events.has(event.aggregateId)) {
        this.events.set(event.aggregateId, []);
      }
      this.events.get(event.aggregateId)!.push(event);
      
      // Store globally
      this.globalEvents.push(event);
      
      // Notify subscribers
      this.eventEmitter.emit(event.eventType, event);
      this.eventEmitter.emit('*', event);
    }
  }

  async getEvents(aggregateId: string, fromVersion = 0): Promise<DomainEvent[]> {
    const events = this.events.get(aggregateId) || [];
    return events.filter(e => e.eventVersion >= fromVersion);
  }

  async getEventsByType(eventType: string, fromTimestamp?: Date): Promise<DomainEvent[]> {
    return this.globalEvents.filter(e => 
      e.eventType === eventType && 
      (!fromTimestamp || e.metadata.timestamp >= fromTimestamp)
    );
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
    
    this.eventEmitter.on(eventType, async (event: DomainEvent) => {
      try {
        await handler.handle(event);
      } catch (error) {
        console.error(`Error handling event ${eventType}:`, error);
      }
    });
  }
}

// Contract Domain Events
export interface ContractUploadedEvent extends DomainEvent {
  eventType: 'ContractUploaded';
  payload: {
    filename: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string;
  };
}

export interface ContractProcessingStartedEvent extends DomainEvent {
  eventType: 'ContractProcessingStarted';
  payload: {
    processingJobId: string;
    stages: string[];
  };
}

export interface ContractStageCompletedEvent extends DomainEvent {
  eventType: 'ContractStageCompleted';
  payload: {
    stage: string;
    result: any;
    nextStage?: string;
  };
}

export interface ContractAnalysisCompletedEvent extends DomainEvent {
  eventType: 'ContractAnalysisCompleted';
  payload: {
    financial: any;
    risk: any;
    compliance: any;
    clauses: any;
  };
}

// Event Factory
export class EventFactory {
  static createEvent<T extends DomainEvent>(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    payload: any,
    metadata: Partial<DomainEvent['metadata']>,
    version = 1
  ): T {
    return {
      id: crypto.randomUUID(),
      aggregateId,
      aggregateType,
      eventType,
      eventVersion: version,
      payload,
      metadata: {
        timestamp: new Date(),
        correlationId: crypto.randomUUID(),
        source: 'contract-intelligence-system',
        ...metadata
      },
      sequence: Date.now()
    } as T;
  }
}

// Export singleton event store
export const eventStore = new InMemoryEventStore();