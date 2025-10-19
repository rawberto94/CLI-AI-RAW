/**
 * Handles fallback logic when primary data source fails
 */

import { IDataProvider, DataProviderResult } from '../types/data-provider.types';
import { DataUnavailableError, DataProviderError } from '../errors/procurement-intelligence-error';

export class DataFallbackHandler {
  /**
   * Attempt to get data from primary provider, fallback to secondary if it fails
   */
  async getData<T>(
    primaryProvider: IDataProvider<T>,
    fallbackProvider: IDataProvider<T>,
    params: any,
    feature: string
  ): Promise<DataProviderResult<T>> {
    try {
      // Try primary provider first
      const available = await primaryProvider.isAvailable();
      
      if (!available) {
        console.warn(`Primary provider unavailable for ${feature}, using fallback`);
        return await this.useFallback(fallbackProvider, params, feature);
      }

      const data = await primaryProvider.getData(params);
      return {
        data,
        metadata: primaryProvider.getMetadata()
      };
    } catch (error) {
      console.error(`Primary provider failed for ${feature}:`, error);
      
      // Use fallback provider
      return await this.useFallback(fallbackProvider, params, feature);
    }
  }

  /**
   * Use fallback provider and add warning to metadata
   */
  private async useFallback<T>(
    fallbackProvider: IDataProvider<T>,
    params: any,
    feature: string
  ): Promise<DataProviderResult<T>> {
    try {
      const data = await fallbackProvider.getData(params);
      const metadata = fallbackProvider.getMetadata();

      return {
        data,
        metadata: {
          ...metadata,
          source: 'mock',
          warning: `Using fallback data for ${feature} due to primary source failure`
        }
      };
    } catch (fallbackError) {
      throw new DataProviderError(
        feature,
        fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError))
      );
    }
  }

  /**
   * Get data with automatic retry logic
   */
  async getDataWithRetry<T>(
    provider: IDataProvider<T>,
    params: any,
    feature: string,
    maxRetries: number = 3
  ): Promise<DataProviderResult<T>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const data = await provider.getData(params);
        return {
          data,
          metadata: provider.getMetadata()
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Attempt ${attempt}/${maxRetries} failed for ${feature}:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new DataProviderError(feature, lastError!);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const dataFallbackHandler = new DataFallbackHandler();
