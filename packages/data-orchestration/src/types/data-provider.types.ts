/**
 * Data Provider Types
 * 
 * Core types for the data provider pattern that enables seamless switching
 * between real production data and mock demo data.
 */

export type DataMode = 'real' | 'mock' | 'auto';

export interface DataSourceMetadata {
  source: 'database' | 'mock' | 'hybrid';
  lastUpdated: Date;
  recordCount: number;
  confidence: number;
  warning?: string;
}

export interface IDataProvider<T> {
  mode: 'real' | 'mock';
  isAvailable(): Promise<boolean>;
  getData(params: any): Promise<T>;
  getMetadata(): DataSourceMetadata;
}

export interface DataProviderConfig {
  mode: DataMode;
  feature: string;
  fallbackToMock?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

export interface DataProviderResult<T> {
  data: T;
  metadata: DataSourceMetadata;
}
