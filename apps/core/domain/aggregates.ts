/**
 * Domain Aggregates with Event Sourcing
 * CQRS Write Model Implementation
 */

import { DomainEvent, EventFactory } from './events';

export abstract class AggregateRoot {
  protected id: string;
  protected version: number = 0;
  protected uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  getVersion(): number {
    return this.version;
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  protected applyEvent(event: DomainEvent): void {
    this.applyChange(event);
    this.uncommittedEvents.push(event);
  }

  protected abstract applyChange(event: DomainEvent): void;

  public loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.applyChange(event);
      this.version = event.eventVersion;
    });
  }
}

// Contract Aggregate
export interface ContractState {
  id: string;
  tenantId: string;
  filename: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  uploadedAt: Date;
  uploadedBy?: string;
  processingJobId?: string;
  extractedText?: string;
  analysis?: {
    financial?: any;
    risk?: any;
    compliance?: any;
    clauses?: any;
  };
  metadata: {
    fileSize: number;
    mimeType: string;
    wordCount?: number;
    pageCount?: number;
  };
}

export class ContractAggregate extends AggregateRoot {
  private state: ContractState;

  constructor(id: string) {
    super(id);
    this.state = {
      id,
      tenantId: '',
      filename: '',
      status: 'uploaded',
      uploadedAt: new Date(),
      metadata: {
        fileSize: 0,
        mimeType: ''
      }
    };
  }

  // Commands
  uploadContract(
    tenantId: string,
    filename: string,
    fileSize: number,
    mimeType: string,
    uploadedBy?: string
  ): void {
    if (this.state.status !== 'uploaded' && this.version > 0) {
      throw new Error('Contract already exists');
    }

    const event = EventFactory.createEvent(
      'ContractUploaded',
      this.id,
      'Contract',
      {
        filename,
        fileSize,
        mimeType,
        uploadedBy
      },
      { tenantId, userId: uploadedBy },
      this.version + 1
    );

    this.applyEvent(event);
  }

  startProcessing(processingJobId: string, stages: string[]): void {
    if (this.state.status !== 'uploaded') {
      throw new Error('Contract must be uploaded before processing');
    }

    const event = EventFactory.createEvent(
      'ContractProcessingStarted',
      this.id,
      'Contract',
      {
        processingJobId,
        stages
      },
      { tenantId: this.state.tenantId },
      this.version + 1
    );

    this.applyEvent(event);
  }

  completeStage(stage: string, result: any, nextStage?: string): void {
    if (this.state.status !== 'processing') {
      throw new Error('Contract must be processing to complete stages');
    }

    const event = EventFactory.createEvent(
      'ContractStageCompleted',
      this.id,
      'Contract',
      {
        stage,
        result,
        nextStage
      },
      { tenantId: this.state.tenantId },
      this.version + 1
    );

    this.applyEvent(event);
  }

  completeAnalysis(analysis: ContractState['analysis']): void {
    if (this.state.status !== 'processing') {
      throw new Error('Contract must be processing to complete analysis');
    }

    const event = EventFactory.createEvent(
      'ContractAnalysisCompleted',
      this.id,
      'Contract',
      analysis,
      { tenantId: this.state.tenantId },
      this.version + 1
    );

    this.applyEvent(event);
  }

  failProcessing(error: string): void {
    const event = EventFactory.createEvent(
      'ContractProcessingFailed',
      this.id,
      'Contract',
      { error },
      { tenantId: this.state.tenantId },
      this.version + 1
    );

    this.applyEvent(event);
  }

  // Event Handlers
  protected applyChange(event: DomainEvent): void {
    switch (event.eventType) {
      case 'ContractUploaded':
        this.applyContractUploaded(event);
        break;
      case 'ContractProcessingStarted':
        this.applyProcessingStarted(event);
        break;
      case 'ContractStageCompleted':
        this.applyStageCompleted(event);
        break;
      case 'ContractAnalysisCompleted':
        this.applyAnalysisCompleted(event);
        break;
      case 'ContractProcessingFailed':
        this.applyProcessingFailed(event);
        break;
    }
  }

  private applyContractUploaded(event: DomainEvent): void {
    this.state.tenantId = event.metadata.tenantId;
    this.state.filename = event.payload.filename;
    this.state.uploadedAt = event.metadata.timestamp;
    this.state.uploadedBy = event.payload.uploadedBy;
    this.state.metadata.fileSize = event.payload.fileSize;
    this.state.metadata.mimeType = event.payload.mimeType;
    this.state.status = 'uploaded';
  }

  private applyProcessingStarted(event: DomainEvent): void {
    this.state.processingJobId = event.payload.processingJobId;
    this.state.status = 'processing';
  }

  private applyStageCompleted(event: DomainEvent): void {
    // Store stage results
    if (!this.state.analysis) {
      this.state.analysis = {};
    }
    
    const stage = event.payload.stage;
    if (stage === 'financial_analysis') {
      this.state.analysis.financial = event.payload.result;
    } else if (stage === 'risk_assessment') {
      this.state.analysis.risk = event.payload.result;
    } else if (stage === 'compliance_check') {
      this.state.analysis.compliance = event.payload.result;
    } else if (stage === 'clause_extraction') {
      this.state.analysis.clauses = event.payload.result;
    }
  }

  private applyAnalysisCompleted(event: DomainEvent): void {
    this.state.analysis = event.payload;
    this.state.status = 'completed';
  }

  private applyProcessingFailed(event: DomainEvent): void {
    this.state.status = 'failed';
  }

  // Getters
  getState(): Readonly<ContractState> {
    return { ...this.state };
  }
}

// Repository Pattern for Aggregates
export interface Repository<T extends AggregateRoot> {
  save(aggregate: T): Promise<void>;
  getById(id: string): Promise<T | null>;
}

export class ContractRepository implements Repository<ContractAggregate> {
  constructor(private eventStore: any) {}

  async save(aggregate: ContractAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    if (events.length > 0) {
      await this.eventStore.append(events);
      aggregate.markEventsAsCommitted();
    }
  }

  async getById(id: string): Promise<ContractAggregate | null> {
    const events = await this.eventStore.getEvents(id);
    if (events.length === 0) {
      return null;
    }

    const aggregate = new ContractAggregate(id);
    aggregate.loadFromHistory(events);
    return aggregate;
  }
}