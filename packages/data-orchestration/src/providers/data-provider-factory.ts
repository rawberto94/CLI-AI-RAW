import { DataProvider, DataProviderType } from '../types/data-provider.types';

class DataProviderFactory {
  createProvider(type: DataProviderType): DataProvider {
    return {
      name: type,
      fetch: async (query: any) => {
        return { 
          data: [], 
          success: true,
          metadata: {
            source: type,
            timestamp: new Date().toISOString(),
            count: 0,
          },
        };
      },
    };
  }

  async getData(type: string, query: any, mode: any) {
    return { 
      data: [], 
      success: true,
      metadata: {
        source: type,
        timestamp: new Date().toISOString(),
        count: 0,
      },
    };
  }
}

export const dataProviderFactory = new DataProviderFactory();
export function getDataProviderFactory() {
  return dataProviderFactory;
}
