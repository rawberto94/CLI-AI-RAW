import { DataProvider, DataProviderType } from '../types/data-provider.types';

class DataProviderFactory {
  createProvider(type: DataProviderType): DataProvider {
    return {
      name: type,
      fetch: async (query: any) => {
        return { data: [], success: true };
      },
    };
  }

  async getData(type: string, query: any, mode: any) {
    return { data: [], success: true };
  }
}

export const dataProviderFactory = new DataProviderFactory();
export function getDataProviderFactory() {
  return dataProviderFactory;
}
