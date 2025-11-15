import { DataSourceMetadata, DataProviderResult } from '../types/data-provider.types';

class DataProviderFactory {
  createProvider(type: string) {
    return {
      name: type,
      fetch: async (query: any): Promise<DataProviderResult<any>> => {
        return { 
          data: [], 
          metadata: {
            source: 'mock',
            timestamp: new Date().toISOString(),
            count: 0,
            mode: 'live',
            lastUpdated: new Date().toISOString(),
            confidence: 1.0,
          } as DataSourceMetadata,
        };
      },
    };
  }

  async getData(type: string, query: any, mode: any): Promise<DataProviderResult<any>> {
    return { 
      data: [], 
      metadata: {
        source: 'mock',
        timestamp: new Date().toISOString(),
        count: 0,
        mode: mode || 'live',
        lastUpdated: new Date().toISOString(),
        confidence: 1.0,
      } as DataSourceMetadata,
    };
  }
}

export const dataProviderFactory = new DataProviderFactory();
export function getDataProviderFactory() {
  return dataProviderFactory;
}
