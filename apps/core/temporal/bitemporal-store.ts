/**
 * Bitemporal Data Store for Contract Versioning
 * Tracks both valid time and system time for complete audit trails
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface TemporalRecord<T = any> {
  id: string;
  entityId: string;
  entityType: string;
  data: T;
  validTime: TimeRange;
  systemTime: TimeRange;
  version: number;
  metadata: {
    tenantId: string;
    userId?: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    reason?: string;
    correlationId?: string;
  };
}

export interface TemporalQuery<T = any> {
  entityId?: string;
  entityType?: string;
  tenantId?: string;
  validTimePoint?: Date;
  validTimeRange?: TimeRange;
  systemTimePoint?: Date;
  systemTimeRange?: TimeRange;
  asOfSystemTime?: Date;
  asOfValidTime?: Date;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface ContractVersion {
  versionId: string;
  contractId: string;
  content: string;
  changes: ChangeRecord[];
  validFrom: Date;
  validTo: Date;
  systemFrom: Date;
  systemTo: Date;
  metadata: {
    author: string;
    reason: string;
    approvedBy?: string;
    tags: string[];
  };
}

export interface ChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'ADD' | 'MODIFY' | 'DELETE';
  timestamp: Date;
  reason?: string;
}

export interface TemporalSnapshot<T = any> {
  timestamp: Date;
  validTime: Date;
  systemTime: Date;
  data: T;
  version: number;
  changesSince?: ChangeRecord[];
}

export interface AuditTrail {
  entityId: string;
  entityType: string;
  timeline: TemporalEvent[];
  totalVersions: number;
  firstVersion: Date;
  lastVersion: Date;
  activeVersions: number;
}

export interface TemporalEvent {
  timestamp: Date;
  eventType: 'CREATED' | 'UPDATED' | 'DELETED' | 'RESTORED';
  version: number;
  validTimeRange: TimeRange;
  systemTimeRange: TimeRange;
  changes: ChangeRecord[];
  metadata: any;
}

export class BitemporalStore<T = any> extends EventEmitter {
  private records = new Map<string, TemporalRecord<T>[]>();
  private entityIndex = new Map<string, Set<string>>(); // entityId -> record IDs
  private typeIndex = new Map<string, Set<string>>(); // entityType -> record IDs
  private tenantIndex = new Map<string, Set<string>>(); // tenantId -> record IDs
  private validTimeIndex = new Map<string, Set<string>>(); // time bucket -> record IDs
  private systemTimeIndex = new Map<string, Set<string>>(); // time bucket -> record IDs

  constructor() {
    super();
    this.setupIndexes();
  }

  /**
   * Insert new temporal record
   */
  async insert(
    entityId: string,
    entityType: string,
    data: T,
    validTime: TimeRange,
    metadata: TemporalRecord<T>['metadata']
  ): Promise<TemporalRecord<T>> {
    const now = new Date();
    const recordId = crypto.randomUUID();

    const record: TemporalRecord<T> = {
      id: recordId,
      entityId,
      entityType,
      data,
      validTime,
      systemTime: {
        start: now,
        end: new Date('9999-12-31') // Open-ended
      },
      version: await this.getNextVersion(entityId),
      metadata: {
        ...metadata,
        operation: 'INSERT'
      }
    };

    // Store record
    if (!this.records.has(entityId)) {
      this.records.set(entityId, []);
    }
    this.records.get(entityId)!.push(record);

    // Update indexes
    this.updateIndexes(record);

    this.emit('record:inserted', record);
    return record;
  }

  /**
   * Update existing record (creates new version)
   */
  async update(
    entityId: string,
    newData: Partial<T>,
    validTime: TimeRange,
    metadata: Omit<TemporalRecord<T>['metadata'], 'operation'>
  ): Promise<TemporalRecord<T>> {
    const now = new Date();
    
    // Get current active record
    const currentRecord = await this.getCurrentRecord(entityId, now, now);
    if (!currentRecord) {
      throw new Error(`No active record found for entity ${entityId}`);
    }

    // Close current record's system time
    currentRecord.systemTime.end = now;

    // Create new record with updated data
    const updatedData = { ...currentRecord.data, ...newData };
    const changes = this.calculateChanges(currentRecord.data, updatedData);

    const newRecord: TemporalRecord<T> = {
      id: crypto.randomUUID(),
      entityId,
      entityType: currentRecord.entityType,
      data: updatedData,
      validTime,
      systemTime: {
        start: now,
        end: new Date('9999-12-31')
      },
      version: currentRecord.version + 1,
      metadata: {
        ...metadata,
        operation: 'UPDATE'
      }
    };

    this.records.get(entityId)!.push(newRecord);
    this.updateIndexes(newRecord);

    this.emit('record:updated', {
      previous: currentRecord,
      current: newRecord,
      changes
    });

    return newRecord;
  }

  /**
   * Soft delete record
   */
  async delete(
    entityId: string,
    validTime: TimeRange,
    metadata: Omit<TemporalRecord<T>['metadata'], 'operation'>
  ): Promise<TemporalRecord<T>> {
    const now = new Date();
    
    const currentRecord = await this.getCurrentRecord(entityId, now, now);
    if (!currentRecord) {
      throw new Error(`No active record found for entity ${entityId}`);
    }

    // Close current record
    currentRecord.systemTime.end = now;

    // Create deletion record
    const deleteRecord: TemporalRecord<T> = {
      id: crypto.randomUUID(),
      entityId,
      entityType: currentRecord.entityType,
      data: currentRecord.data, // Keep data for audit purposes
      validTime,
      systemTime: {
        start: now,
        end: new Date('9999-12-31')
      },
      version: currentRecord.version + 1,
      metadata: {
        ...metadata,
        operation: 'DELETE'
      }
    };

    this.records.get(entityId)!.push(deleteRecord);
    this.updateIndexes(deleteRecord);

    this.emit('record:deleted', deleteRecord);
    return deleteRecord;
  }

  /**
   * Query temporal records
   */
  async query(query: TemporalQuery<T>): Promise<TemporalRecord<T>[]> {
    let candidateRecords = new Set<string>();

    // Apply entity filter
    if (query.entityId) {
      const entityRecords = this.entityIndex.get(query.entityId) || new Set();
      candidateRecords = new Set(entityRecords);
    }

    // Apply type filter
    if (query.entityType) {
      const typeRecords = this.typeIndex.get(query.entityType) || new Set();
      candidateRecords = candidateRecords.size === 0 
        ? new Set(typeRecords)
        : this.intersect(candidateRecords, typeRecords);
    }

    // Apply tenant filter
    if (query.tenantId) {
      const tenantRecords = this.tenantIndex.get(query.tenantId) || new Set();
      candidateRecords = candidateRecords.size === 0
        ? new Set(tenantRecords)
        : this.intersect(candidateRecords, tenantRecords);
    }

    // If no filters applied, get all records
    if (candidateRecords.size === 0) {
      candidateRecords = new Set(
        Array.from(this.records.values()).flat().map(r => r.id)
      );
    }

    // Filter by temporal constraints
    let results: TemporalRecord<T>[] = [];
    
    for (const recordId of candidateRecords) {
      const record = this.findRecordById(recordId);
      if (!record) continue;

      // Apply temporal filters
      if (!this.matchesTemporalConstraints(record, query)) continue;

      // Apply deletion filter
      if (!query.includeDeleted && record.metadata.operation === 'DELETE') continue;

      results.push(record);
    }

    // Sort by system time (newest first)
    results.sort((a, b) => b.systemTime.start.getTime() - a.systemTime.start.getTime());

    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get record as of specific point in time
   */
  async getAsOf(
    entityId: string,
    validTime: Date,
    systemTime: Date
  ): Promise<TemporalRecord<T> | null> {
    const records = this.records.get(entityId) || [];
    
    // Find record that was valid at the specified times
    for (const record of records) {
      if (this.isTimeInRange(validTime, record.validTime) &&
          this.isTimeInRange(systemTime, record.systemTime)) {
        return record;
      }
    }

    return null;
  }

  /**
   * Get current active record
   */
  async getCurrentRecord(
    entityId: string,
    validTime: Date = new Date(),
    systemTime: Date = new Date()
  ): Promise<TemporalRecord<T> | null> {
    return this.getAsOf(entityId, validTime, systemTime);
  }

  /**
   * Get complete audit trail for entity
   */
  async getAuditTrail(entityId: string): Promise<AuditTrail> {
    const records = this.records.get(entityId) || [];
    
    if (records.length === 0) {
      throw new Error(`No records found for entity ${entityId}`);
    }

    const timeline: TemporalEvent[] = records.map(record => ({
      timestamp: record.systemTime.start,
      eventType: this.getEventType(record),
      version: record.version,
      validTimeRange: record.validTime,
      systemTimeRange: record.systemTime,
      changes: this.getChangesForRecord(record, records),
      metadata: record.metadata
    }));

    // Sort by system time
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const activeVersions = records.filter(r => 
      r.systemTime.end.getTime() > Date.now() && 
      r.metadata.operation !== 'DELETE'
    ).length;

    return {
      entityId,
      entityType: records[0].entityType,
      timeline,
      totalVersions: records.length,
      firstVersion: timeline[0]?.timestamp || new Date(),
      lastVersion: timeline[timeline.length - 1]?.timestamp || new Date(),
      activeVersions
    };
  }

  /**
   * Get temporal snapshots at regular intervals
   */
  async getTemporalSnapshots(
    entityId: string,
    startTime: Date,
    endTime: Date,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<TemporalSnapshot<T>[]> {
    const snapshots: TemporalSnapshot<T>[] = [];
    const intervalMs = this.getIntervalMs(interval);
    
    for (let time = startTime.getTime(); time <= endTime.getTime(); time += intervalMs) {
      const snapshotTime = new Date(time);
      const record = await this.getAsOf(entityId, snapshotTime, snapshotTime);
      
      if (record) {
        const previousSnapshot = snapshots[snapshots.length - 1];
        const changes = previousSnapshot 
          ? this.calculateChanges(previousSnapshot.data, record.data)
          : [];

        snapshots.push({
          timestamp: snapshotTime,
          validTime: snapshotTime,
          systemTime: snapshotTime,
          data: record.data,
          version: record.version,
          changesSince: changes
        });
      }
    }

    return snapshots;
  }

  /**
   * Time travel query - get all versions between time points
   */
  async timeTravel(
    entityId: string,
    fromTime: Date,
    toTime: Date,
    timeType: 'valid' | 'system' = 'system'
  ): Promise<TemporalRecord<T>[]> {
    const records = this.records.get(entityId) || [];
    
    return records.filter(record => {
      const timeRange = timeType === 'valid' ? record.validTime : record.systemTime;
      return this.rangesOverlap(
        { start: fromTime, end: toTime },
        timeRange
      );
    }).sort((a, b) => {
      const timeA = timeType === 'valid' ? a.validTime.start : a.systemTime.start;
      const timeB = timeType === 'valid' ? b.validTime.start : b.systemTime.start;
      return timeA.getTime() - timeB.getTime();
    });
  }

  /**
   * Restore entity to previous version
   */
  async restoreToVersion(
    entityId: string,
    targetVersion: number,
    validTime: TimeRange,
    metadata: Omit<TemporalRecord<T>['metadata'], 'operation'>
  ): Promise<TemporalRecord<T>> {
    const records = this.records.get(entityId) || [];
    const targetRecord = records.find(r => r.version === targetVersion);
    
    if (!targetRecord) {
      throw new Error(`Version ${targetVersion} not found for entity ${entityId}`);
    }

    // Create new record with old data
    const restoredRecord = await this.insert(
      entityId,
      targetRecord.entityType,
      targetRecord.data,
      validTime,
      {
        ...metadata,
        reason: `Restored to version ${targetVersion}`,
        correlationId: targetRecord.id
      }
    );

    this.emit('record:restored', {
      entityId,
      fromVersion: targetVersion,
      toVersion: restoredRecord.version,
      restoredRecord
    });

    return restoredRecord;
  }

  /**
   * Compact old versions (for storage optimization)
   */
  async compactHistory(
    entityId: string,
    keepVersions: number = 10,
    olderThan: Date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year
  ): Promise<{ compacted: number; kept: number }> {
    const records = this.records.get(entityId) || [];
    
    // Sort by version (newest first)
    const sortedRecords = records.sort((a, b) => b.version - a.version);
    
    // Keep recent versions and important milestones
    const toKeep: TemporalRecord<T>[] = [];
    const toCompact: TemporalRecord<T>[] = [];
    
    sortedRecords.forEach((record, index) => {
      const shouldKeep = 
        index < keepVersions || // Keep recent versions
        record.systemTime.start > olderThan || // Keep recent by time
        record.metadata.operation === 'INSERT' || // Keep creation
        record.metadata.operation === 'DELETE'; // Keep deletion
      
      if (shouldKeep) {
        toKeep.push(record);
      } else {
        toCompact.push(record);
      }
    });

    // Update records
    this.records.set(entityId, toKeep);
    
    // Update indexes
    toCompact.forEach(record => {
      this.removeFromIndexes(record);
    });

    this.emit('history:compacted', {
      entityId,
      compacted: toCompact.length,
      kept: toKeep.length
    });

    return {
      compacted: toCompact.length,
      kept: toKeep.length
    };
  }

  // Private helper methods

  private setupIndexes(): void {
    // Indexes are initialized as empty maps
  }

  private updateIndexes(record: TemporalRecord<T>): void {
    // Entity index
    if (!this.entityIndex.has(record.entityId)) {
      this.entityIndex.set(record.entityId, new Set());
    }
    this.entityIndex.get(record.entityId)!.add(record.id);

    // Type index
    if (!this.typeIndex.has(record.entityType)) {
      this.typeIndex.set(record.entityType, new Set());
    }
    this.typeIndex.get(record.entityType)!.add(record.id);

    // Tenant index
    if (!this.tenantIndex.has(record.metadata.tenantId)) {
      this.tenantIndex.set(record.metadata.tenantId, new Set());
    }
    this.tenantIndex.get(record.metadata.tenantId)!.add(record.id);

    // Time indexes (bucketed by day)
    const validBucket = this.getTimeBucket(record.validTime.start);
    const systemBucket = this.getTimeBucket(record.systemTime.start);

    if (!this.validTimeIndex.has(validBucket)) {
      this.validTimeIndex.set(validBucket, new Set());
    }
    this.validTimeIndex.get(validBucket)!.add(record.id);

    if (!this.systemTimeIndex.has(systemBucket)) {
      this.systemTimeIndex.set(systemBucket, new Set());
    }
    this.systemTimeIndex.get(systemBucket)!.add(record.id);
  }

  private removeFromIndexes(record: TemporalRecord<T>): void {
    this.entityIndex.get(record.entityId)?.delete(record.id);
    this.typeIndex.get(record.entityType)?.delete(record.id);
    this.tenantIndex.get(record.metadata.tenantId)?.delete(record.id);
    
    const validBucket = this.getTimeBucket(record.validTime.start);
    const systemBucket = this.getTimeBucket(record.systemTime.start);
    
    this.validTimeIndex.get(validBucket)?.delete(record.id);
    this.systemTimeIndex.get(systemBucket)?.delete(record.id);
  }

  private getTimeBucket(date: Date): string {
    // Bucket by day: YYYY-MM-DD
    return date.toISOString().split('T')[0];
  }

  private async getNextVersion(entityId: string): Promise<number> {
    const records = this.records.get(entityId) || [];
    return records.length > 0 
      ? Math.max(...records.map(r => r.version)) + 1 
      : 1;
  }

  private calculateChanges(oldData: T, newData: T): ChangeRecord[] {
    const changes: ChangeRecord[] = [];
    const now = new Date();

    // Simple field-by-field comparison
    const oldObj = oldData as any;
    const newObj = newData as any;

    // Check for modified and added fields
    for (const key in newObj) {
      if (oldObj[key] !== newObj[key]) {
        changes.push({
          field: key,
          oldValue: oldObj[key],
          newValue: newObj[key],
          changeType: oldObj.hasOwnProperty(key) ? 'MODIFY' : 'ADD',
          timestamp: now
        });
      }
    }

    // Check for deleted fields
    for (const key in oldObj) {
      if (!newObj.hasOwnProperty(key)) {
        changes.push({
          field: key,
          oldValue: oldObj[key],
          newValue: undefined,
          changeType: 'DELETE',
          timestamp: now
        });
      }
    }

    return changes;
  }

  private findRecordById(recordId: string): TemporalRecord<T> | undefined {
    for (const records of this.records.values()) {
      const record = records.find(r => r.id === recordId);
      if (record) return record;
    }
    return undefined;
  }

  private matchesTemporalConstraints(
    record: TemporalRecord<T>,
    query: TemporalQuery<T>
  ): boolean {
    // Valid time constraints
    if (query.validTimePoint && !this.isTimeInRange(query.validTimePoint, record.validTime)) {
      return false;
    }

    if (query.validTimeRange && !this.rangesOverlap(query.validTimeRange, record.validTime)) {
      return false;
    }

    // System time constraints
    if (query.systemTimePoint && !this.isTimeInRange(query.systemTimePoint, record.systemTime)) {
      return false;
    }

    if (query.systemTimeRange && !this.rangesOverlap(query.systemTimeRange, record.systemTime)) {
      return false;
    }

    // As-of constraints
    if (query.asOfSystemTime && record.systemTime.start > query.asOfSystemTime) {
      return false;
    }

    if (query.asOfValidTime && record.validTime.start > query.asOfValidTime) {
      return false;
    }

    return true;
  }

  private isTimeInRange(time: Date, range: TimeRange): boolean {
    return time >= range.start && time <= range.end;
  }

  private rangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
    return range1.start <= range2.end && range2.start <= range1.end;
  }

  private intersect<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    return new Set([...setA].filter(x => setB.has(x)));
  }

  private getEventType(record: TemporalRecord<T>): TemporalEvent['eventType'] {
    switch (record.metadata.operation) {
      case 'INSERT': return 'CREATED';
      case 'UPDATE': return 'UPDATED';
      case 'DELETE': return 'DELETED';
      default: return 'UPDATED';
    }
  }

  private getChangesForRecord(
    record: TemporalRecord<T>,
    allRecords: TemporalRecord<T>[]
  ): ChangeRecord[] {
    const previousRecord = allRecords
      .filter(r => r.version < record.version)
      .sort((a, b) => b.version - a.version)[0];

    if (!previousRecord) return [];

    return this.calculateChanges(previousRecord.data, record.data);
  }

  private getIntervalMs(interval: string): number {
    const intervals = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    return intervals[interval] || intervals.day;
  }

  // Public API methods

  getStats(): {
    totalRecords: number;
    entitiesCount: number;
    entityTypesCount: number;
    tenantsCount: number;
    averageVersionsPerEntity: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
  } {
    const totalRecords = Array.from(this.records.values()).reduce((sum, records) => sum + records.length, 0);
    const entitiesCount = this.records.size;
    const entityTypesCount = this.typeIndex.size;
    const tenantsCount = this.tenantIndex.size;

    let oldestRecord: Date | null = null;
    let newestRecord: Date | null = null;

    for (const records of this.records.values()) {
      for (const record of records) {
        if (!oldestRecord || record.systemTime.start < oldestRecord) {
          oldestRecord = record.systemTime.start;
        }
        if (!newestRecord || record.systemTime.start > newestRecord) {
          newestRecord = record.systemTime.start;
        }
      }
    }

    return {
      totalRecords,
      entitiesCount,
      entityTypesCount,
      tenantsCount,
      averageVersionsPerEntity: entitiesCount > 0 ? totalRecords / entitiesCount : 0,
      oldestRecord,
      newestRecord
    };
  }
}

// Specialized contract temporal store
export class ContractTemporalStore extends BitemporalStore<any> {
  async createContractVersion(
    contractId: string,
    content: string,
    validFrom: Date,
    validTo: Date,
    metadata: {
      tenantId: string;
      author: string;
      reason: string;
      approvedBy?: string;
      tags?: string[];
    }
  ): Promise<ContractVersion> {
    const versionId = crypto.randomUUID();
    
    // Get previous version for change calculation
    const currentRecord = await this.getCurrentRecord(contractId);
    const changes = currentRecord 
      ? this.calculateChanges(currentRecord.data, { content })
      : [];

    const contractVersion: ContractVersion = {
      versionId,
      contractId,
      content,
      changes,
      validFrom,
      validTo,
      systemFrom: new Date(),
      systemTo: new Date('9999-12-31'),
      metadata: {
        author: metadata.author,
        reason: metadata.reason,
        approvedBy: metadata.approvedBy,
        tags: metadata.tags || []
      }
    };

    await this.insert(
      contractId,
      'contract',
      contractVersion,
      { start: validFrom, end: validTo },
      {
        tenantId: metadata.tenantId,
        userId: metadata.author,
        reason: metadata.reason
      }
    );

    return contractVersion;
  }

  async getContractHistory(contractId: string): Promise<ContractVersion[]> {
    const records = await this.query({
      entityId: contractId,
      entityType: 'contract'
    });

    return records.map(record => record.data as ContractVersion);
  }

  async getContractAtTime(
    contractId: string,
    validTime: Date,
    systemTime: Date = new Date()
  ): Promise<ContractVersion | null> {
    const record = await this.getAsOf(contractId, validTime, systemTime);
    return record ? record.data as ContractVersion : null;
  }
}

// Export singleton instances
export const bitemporalStore = new BitemporalStore();
export const contractTemporalStore = new ContractTemporalStore();