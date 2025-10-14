// Analytical Engines Index
// This file provides a centralized way to import and manage all analytical engines

export * from './rate-card-benchmarking.engine';
export * from './renewal-radar.engine';
export * from './clause-compliance.engine';
export * from './supplier-snapshot.engine';
export * from './spend-overlay.engine';
export * from './natural-language-query.engine';

// Engine Registry for dependency injection
export interface EngineRegistry {
  rateCardEngine?: any;
  renewalEngine?: any;
  complianceEngine?: any;
  supplierEngine?: any;
  spendEngine?: any;
  nlqEngine?: any;
}

// Engine factory for creating instances
export class AnalyticalEngineFactory {
  private static registry: EngineRegistry = {};

  static registerEngine(name: keyof EngineRegistry, engine: any): void {
    this.registry[name] = engine;
  }

  static getEngine<T>(name: keyof EngineRegistry): T | undefined {
    return this.registry[name] as T;
  }

  static getAllEngines(): EngineRegistry {
    return { ...this.registry };
  }

  static isEngineRegistered(name: keyof EngineRegistry): boolean {
    return !!this.registry[name];
  }
}

// Engine status interface
export interface EngineStatus {
  name: string;
  initialized: boolean;
  healthy: boolean;
  lastHealthCheck?: Date;
  error?: string;
}

// Health check utility
export class EngineHealthChecker {
  static async checkAllEngines(): Promise<EngineStatus[]> {
    const registry = AnalyticalEngineFactory.getAllEngines();
    const statuses: EngineStatus[] = [];

    for (const [name, engine] of Object.entries(registry)) {
      try {
        const healthy = engine && typeof engine.healthCheck === 'function' 
          ? await engine.healthCheck() 
          : !!engine;

        statuses.push({
          name,
          initialized: !!engine,
          healthy,
          lastHealthCheck: new Date()
        });
      } catch (error) {
        statuses.push({
          name,
          initialized: !!engine,
          healthy: false,
          lastHealthCheck: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return statuses;
  }
}