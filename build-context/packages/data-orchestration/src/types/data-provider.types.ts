/**
 * Data Provider Types
 * 
 * Core types for the data provider pattern that enables seamless switching
 * between real production data and mock demo data.
 */

export type DataMode = 'real' | 'mock' | 'auto';

export interface DataSourceMetadata {
  source: 'database' | 'mock' | 'hybrid';
  timestamp?: string;
  lastUpdated: Date | string;
  recordCount?: number;
  count?: number;
  mode?: string;
  confidence: number;
  warning?: string;
}

export interface IDataProvider<T> {
  mode: 'real' | 'mock';
  isAvailable(): Promise<boolean>;
  getData(params: Record<string, unknown>): Promise<T>;
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

export const DataMode = {
  REAL: 'real' as DataMode,
  MOCK: 'mock' as DataMode,
  AUTO: 'auto' as DataMode,
};
