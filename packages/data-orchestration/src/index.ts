// @ts-nocheck
// Note: This file uses @ts-nocheck due to intentional duplicate exports
// from types, lineage, and services. Consumers should import from specific
// modules if they need type-safe imports.

// Main exports
export * from "./types";
export * from "./dal";
export * from "./lineage";
export * from "./providers/data-provider-factory";

// Export service classes
export * from "./services";

// Export event system
export * from "./events";

// Export type aliases for commonly used services
export type { 
  EnhancedSavingsOpportunity,
  SavingsAnalysisResult 
} from "./services/enhanced-savings-opportunities.service";
