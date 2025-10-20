// Re-export data-orchestration package from the workspace
// Provide safe fallbacks for services that may not be exported yet
// This workaround helps Next.js/Turbopack resolve workspace package exports
const pkg = require("../../../packages/data-orchestration/dist/index.js");

// Re-export everything available
module.exports = {
  ...pkg,
  // Provide aliases / fallbacks for expected service names
  analyticalIntelligenceService:
    pkg.analyticalIntelligenceService || pkg.intelligenceProcessor || {},
  dataStandardizationService: pkg.dataStandardizationService || {},
  databaseOptimizationService:
    pkg.databaseOptimizationService || pkg.databaseOptimizationService || {},
  rateCardManagementService: pkg.rateCardManagementService || {},
};

// Also provide named exports for TS/ES import style
exports.contractService = pkg.contractService;
exports.artifactService = pkg.artifactService;
exports.taxonomyService = pkg.taxonomyService;
exports.intelligenceProcessor = pkg.intelligenceProcessor;
exports.eventBus = pkg.eventBus;
exports.Events = pkg.Events;
exports.contractIndexingService = pkg.contractIndexingService;
exports.databaseOptimizationService = pkg.databaseOptimizationService;
exports.rateCardManagementService = pkg.rateCardManagementService;
exports.dataLineageTracker = pkg.dataLineageTracker;
exports.ContractQuerySchema = pkg.ContractQuerySchema;
