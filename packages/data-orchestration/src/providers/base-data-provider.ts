/**
 * Base Data Provider
 * 
 * Abstract base class for all data providers implementing common functionality.
 */

import { IDataProvider, DataSourceMetadata } from '../types/data-provider.types';
import pino from 'pino';

const logger = pino({ name: 'base-data-provider' });

export abstract class BaseDataProvider<T> implements IDataProvider<T> {
  abstract mode: 'real' | 'mock';
  protected feature: string;
  protected lastFetch?: Date;
  protected recordCount: number = 0;

  constructor(feature: string) {
    this.feature = feature;
  }

  abstract isAvailable(): Promise<boolean>;
  abstract getData(params: any): Promise<T>;

  getMetadata(): DataSourceMetadata {
    return {
      source: this.mode === 'real' ? 'database' : 'mock',
      lastUpdated: this.lastFetch || new Date(),
      recordCount: this.recordCount,
      confidence: this.mode === 'real' ? 0.95 : 0.75,
    };
  }

  protected updateMetadata(recordCount: number): void {
    this.lastFetch = new Date();
    this.recordCount = recordCount;
  }

  protected logAccess(params: any): void {
    logger.debug({
      feature: this.feature,
      mode: this.mode,
      params,
    }, 'Data provider accessed');
  }
}
