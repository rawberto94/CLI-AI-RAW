/**
 * Comprehensive LLM and RAG System Audit
 * Scans entire repository to achieve 100% coverage and eliminate redundancies
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('🔍 Starting Comprehensive LLM and RAG System Audit...');

// Configuration
const SCAN_DIRECTORIES = [
  'apps/workers',
  'packages/clients/db/src/services',
  'packages/schemas/src',
  'apps/api/src/services',
  'apps/web/components'
];

const WORKER_FILES = [];
const SERVICE_FILES = [];
const SCHEMA_FILES = [];
const API_FILES = [];
const COMPONENT_FILES = [];
const REDUNDANCIES = [];
const LLM_GAPS = [];
const RAG_GAPS = [];

// Audit Results
const auditResults = {
  workers: {
    total: 0,
    withLLM: 0,
    withRAG: 0,
    withBestPractices: 0,
    withConfidenceScoring: 0,
    withErrorHandling: 0
  },
  services: {
    total: 0,
    withLLM: 0,
    withRAG: 0,
    withIndexing: 0,
    withSearch: 0
  },
  schemas: {
    total: 0,
    withValidation: 0,
    withMetadata: 0,
    withProvenance: 0
  },
  redundancies: {
    duplicateCode: [],
    duplicateLogic: [],
    duplicateImports: [],
    duplicateSchemas: []
  },
  coverage: {
    llmIntegration: 0,
    ragSystem: 0,
    searchIndexing: 0,
    bestPractices: 0
  }
};

/**
 * Recursively scan directory for files
 */
function scanDirectory(dir, fileArray, extensions = ['.ts', '.js', '.tsx']) {
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && !item.includes('node_modules')) {
        scanDirectory(fullPath, fileArray, extensions);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        fileArray.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not scan directory ${dir}:`, error.message);
  }
}

/**
 * Analyze file content for LLM integration
 */
function analyzeLLMIntegration(filePath, content) {
  const analysis = {
    hasOpenAI: false,
    hasGPT4: false,
    hasLLMPrompts: false,
    hasConfidenceScoring: false,
    hasBestPractices: false,
    hasErrorHandling: false,
    hasRetryLogic: false,
    hasFallback: false
  };

  // Check for OpenAI integration
  if (content.includes('openai') || content.includes('OpenAI')) {
    analysis.hasOpenAI = true;
  }

  // Check for GPT-4 usage
  if (content.includes('gpt-4') || content.includes('gpt-4o')) {
    analysis.hasGPT4 = true;
  }

  // Check for LLM prompts
  if (content.includes('prompt') || content.includes('messages') || content.includes('system') || content.includes('user')) {
    analysis.hasLLMPrompts = true;
  }

  // Check for confidence scoring
  if (content.includes('confidence') || content.includes('confidenceScore')) {
    analysis.hasConfidenceScoring = true;
  }

  // Check for best practices
  if (content.includes('bestPractices') || content.includes('recommendations') || content.includes('strategies')) {
    analysis.hasBestPractices = true;
  }

  // Check for error handling
  if (content.includes('try') && content.includes('catch') && content.includes('error')) {
    analysis.hasErrorHandling = true;
  }

  // Check for retry logic
  if (content.includes('retry') || content.includes('attempt') || content.includes('backoff')) {
    analysis.hasRetryLogic = true;
  }

  // Check for fallback mechanisms
  if (content.includes('fallback') || content.includes('heuristic') || content.includes('backup')) {
    analysis.hasFallback = true;
  }

  return analysis;
}

/**
 * Analyze file content for RAG system integration
 */
function analyzeRAGIntegration(filePath, content) {
  const analysis = {
    hasVectorEmbeddings: false,
    hasSemanticSearch: false,
    hasIndexing: false,
    hasSearchVector: false,
    hasMetadataExtraction: false,
    hasContentProcessing: false,
    hasSearchQueries: false,
    hasRelevanceScoring: false
  };

  // Check for vector embeddings
  if (content.includes('embedding') || content.includes('vector') || content.includes('VECTOR')) {
    analysis.hasVectorEmbeddings = true;
  }

  // Check for semantic search
  if (content.includes('semantic') || content.includes('similarity') || content.includes('cosine')) {
    analysis.hasSemanticSearch = true;
  }

  // Check for indexing
  if (content.includes('index') || content.includes('tsvector') || content.includes('search_vector')) {
    analysis.hasIndexing = true;
  }

  // Check for search vectors
  if (content.includes('search_vector') || content.includes('to_tsvector') || content.includes('plainto_tsquery')) {
    analysis.hasSearchVector = true;
  }

  // Check for metadata extraction
  if (content.includes('metadata') || content.includes('extractSearchableContent') || content.includes('searchableContent')) {
    analysis.hasMetadataExtraction = true;
  }

  // Check for content processing
  if (content.includes('processArtifact') || content.includes('extractContent') || content.includes('parseContent')) {
    analysis.hasContentProcessing = true;
  }

  // Check for search queries
  if (content.includes('searchContracts') || content.includes('SearchQuery') || content.includes('SearchResult')) {
    analysis.hasSearchQueries = true;
  }

  // Check for relevance scoring
  if (content.includes('relevance') || content.includes('ts_rank') || content.includes('score')) {
    analysis.hasRelevanceScoring = true;
  }

  return analysis;
}

/**
 * Detect code redundancies
 */
function detectRedundancies(files) {
  const codeBlocks = new Map();
  const imports = new Map();
  const functions = new Map();

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf8');
      
      // Extract imports
      const importMatches = content.match(/import.*from.*['"`].*['"`]/g) || [];
      for (const importLine of importMatches) {
        if (!imports.has(importLine)) {
          imports.set(importLine, []);
        }
        imports.get(importLine).push(filePath);
      }

      // Extract function signatures
      const functionMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)/g) || [];
      for (const funcSig of functionMatches) {
        if (!functions.has(funcSig)) {
          functions.set(funcSig, []);
        }
        functions.get(funcSig).push(filePath);
      }

      // Extract code blocks (simplified)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length - 5; i++) {
        const block = lines.slice(i, i + 5).join('\n').trim();
        if (block.length > 100 && !block.includes('//') && !block.includes('*')) {
          if (!codeBlocks.has(block)) {
            codeBlocks.set(block, []);
          }
          codeBlocks.get(block).push(`${filePath}:${i + 1}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not analyze ${filePath}:`, error.message);
    }
  }

  // Find redundancies
  const redundancies = {
    duplicateImports: [],
    duplicateFunctions: [],
    duplicateCodeBlocks: []
  };

  for (const [importLine, files] of imports) {
    if (files.length > 3) {
      redundancies.duplicateImports.push({ import: importLine, files });
    }
  }

  for (const [funcSig, files] of functions) {
    if (files.length > 1) {
      redundancies.duplicateFunctions.push({ function: funcSig, files });
    }
  }

  for (const [block, locations] of codeBlocks) {
    if (locations.length > 1) {
      redundancies.duplicateCodeBlocks.push({ block: block.substring(0, 100) + '...', locations });
    }
  }

  return redundancies;
}

/**
 * Main audit function
 */
async function runComprehensiveAudit() {
  console.log('\n📁 Scanning directories...');

  // Scan all directories
  scanDirectory('apps/workers', WORKER_FILES);
  scanDirectory('packages/clients/db/src/services', SERVICE_FILES);
  scanDirectory('packages/schemas/src', SCHEMA_FILES);
  scanDirectory('apps/api/src/services', API_FILES);
  scanDirectory('apps/web/components', COMPONENT_FILES);

  console.log(`📊 Found files:`);
  console.log(`   Workers: ${WORKER_FILES.length}`);
  console.log(`   Services: ${SERVICE_FILES.length}`);
  console.log(`   Schemas: ${SCHEMA_FILES.length}`);
  console.log(`   API Services: ${API_FILES.length}`);
  console.log(`   Components: ${COMPONENT_FILES.length}`);

  // Analyze workers
  console.log('\n🔧 Analyzing Workers...');
  auditResults.workers.total = WORKER_FILES.length;

  for (const workerFile of WORKER_FILES) {
    try {
      const content = readFileSync(workerFile, 'utf8');
      const llmAnalysis = analyzeLLMIntegration(workerFile, content);
      const ragAnalysis = analyzeRAGIntegration(workerFile, content);

      if (llmAnalysis.hasOpenAI || llmAnalysis.hasGPT4) auditResults.workers.withLLM++;
      if (ragAnalysis.hasIndexing || ragAnalysis.hasSemanticSearch) auditResults.workers.withRAG++;
      if (llmAnalysis.hasBestPractices) auditResults.workers.withBestPractices++;
      if (llmAnalysis.hasConfidenceScoring) auditResults.workers.withConfidenceScoring++;
      if (llmAnalysis.hasErrorHandling) auditResults.workers.withErrorHandling++;

      // Check for gaps
      if (!llmAnalysis.hasOpenAI && workerFile.includes('.worker.ts')) {
        LLM_GAPS.push(`${workerFile} - Missing LLM integration`);
      }
      if (!ragAnalysis.hasIndexing && workerFile.includes('.worker.ts')) {
        RAG_GAPS.push(`${workerFile} - Missing RAG integration`);
      }

      console.log(`   ✅ ${workerFile.split('/').pop()}: LLM=${llmAnalysis.hasOpenAI}, RAG=${ragAnalysis.hasIndexing}, BP=${llmAnalysis.hasBestPractices}`);
    } catch (error) {
      console.warn(`   ⚠️ Could not analyze ${workerFile}:`, error.message);
    }
  }

  // Analyze services
  console.log('\n🔧 Analyzing Services...');
  auditResults.services.total = SERVICE_FILES.length;

  for (const serviceFile of SERVICE_FILES) {
    try {
      const content = readFileSync(serviceFile, 'utf8');
      const llmAnalysis = analyzeLLMIntegration(serviceFile, content);
      const ragAnalysis = analyzeRAGIntegration(serviceFile, content);

      if (llmAnalysis.hasOpenAI) auditResults.services.withLLM++;
      if (ragAnalysis.hasIndexing) auditResults.services.withIndexing++;
      if (ragAnalysis.hasSemanticSearch) auditResults.services.withSearch++;
      if (ragAnalysis.hasVectorEmbeddings) auditResults.services.withRAG++;

      console.log(`   ✅ ${serviceFile.split('/').pop()}: LLM=${llmAnalysis.hasOpenAI}, Indexing=${ragAnalysis.hasIndexing}, Search=${ragAnalysis.hasSemanticSearch}`);
    } catch (error) {
      console.warn(`   ⚠️ Could not analyze ${serviceFile}:`, error.message);
    }
  }

  // Analyze schemas
  console.log('\n📋 Analyzing Schemas...');
  auditResults.schemas.total = SCHEMA_FILES.length;

  for (const schemaFile of SCHEMA_FILES) {
    try {
      const content = readFileSync(schemaFile, 'utf8');
      
      if (content.includes('z.object') || content.includes('Schema')) auditResults.schemas.withValidation++;
      if (content.includes('metadata') || content.includes('BaseMetadata')) auditResults.schemas.withMetadata++;
      if (content.includes('provenance') || content.includes('worker')) auditResults.schemas.withProvenance++;

      console.log(`   ✅ ${schemaFile.split('/').pop()}: Validation=true, Metadata=${content.includes('metadata')}`);
    } catch (error) {
      console.warn(`   ⚠️ Could not analyze ${schemaFile}:`, error.message);
    }
  }

  // Detect redundancies
  console.log('\n🔍 Detecting Redundancies...');
  const allFiles = [...WORKER_FILES, ...SERVICE_FILES, ...API_FILES];
  const redundancies = detectRedundancies(allFiles);
  auditResults.redundancies = redundancies;

  // Calculate coverage percentages
  auditResults.coverage.llmIntegration = Math.round((auditResults.workers.withLLM / auditResults.workers.total) * 100);
  auditResults.coverage.ragSystem = Math.round((auditResults.workers.withRAG / auditResults.workers.total) * 100);
  auditResults.coverage.searchIndexing = Math.round((auditResults.services.withIndexing / auditResults.services.total) * 100);
  auditResults.coverage.bestPractices = Math.round((auditResults.workers.withBestPractices / auditResults.workers.total) * 100);

  // Generate report
  console.log('\n📊 COMPREHENSIVE AUDIT RESULTS');
  console.log('================================');
  
  console.log('\n🔧 WORKERS ANALYSIS:');
  console.log(`   Total Workers: ${auditResults.workers.total}`);
  console.log(`   With LLM Integration: ${auditResults.workers.withLLM} (${auditResults.coverage.llmIntegration}%)`);
  console.log(`   With RAG Integration: ${auditResults.workers.withRAG} (${auditResults.coverage.ragSystem}%)`);
  console.log(`   With Best Practices: ${auditResults.workers.withBestPractices} (${auditResults.coverage.bestPractices}%)`);
  console.log(`   With Confidence Scoring: ${auditResults.workers.withConfidenceScoring}`);
  console.log(`   With Error Handling: ${auditResults.workers.withErrorHandling}`);

  console.log('\n🔧 SERVICES ANALYSIS:');
  console.log(`   Total Services: ${auditResults.services.total}`);
  console.log(`   With LLM Integration: ${auditResults.services.withLLM}`);
  console.log(`   With RAG Integration: ${auditResults.services.withRAG}`);
  console.log(`   With Search Indexing: ${auditResults.services.withIndexing}`);
  console.log(`   With Semantic Search: ${auditResults.services.withSearch}`);

  console.log('\n📋 SCHEMAS ANALYSIS:');
  console.log(`   Total Schemas: ${auditResults.schemas.total}`);
  console.log(`   With Validation: ${auditResults.schemas.withValidation}`);
  console.log(`   With Metadata: ${auditResults.schemas.withMetadata}`);
  console.log(`   With Provenance: ${auditResults.schemas.withProvenance}`);

  console.log('\n🔍 REDUNDANCY ANALYSIS:');
  console.log(`   Duplicate Imports: ${redundancies.duplicateImports.length}`);
  console.log(`   Duplicate Functions: ${redundancies.duplicateFunctions.length}`);
  console.log(`   Duplicate Code Blocks: ${redundancies.duplicateCodeBlocks.length}`);

  if (redundancies.duplicateImports.length > 0) {
    console.log('\n   📋 Most Common Duplicate Imports:');
    redundancies.duplicateImports.slice(0, 5).forEach(dup => {
      console.log(`      ${dup.import} (${dup.files.length} files)`);
    });
  }

  if (redundancies.duplicateFunctions.length > 0) {
    console.log('\n   🔧 Duplicate Functions:');
    redundancies.duplicateFunctions.slice(0, 5).forEach(dup => {
      console.log(`      ${dup.function} (${dup.files.length} files)`);
    });
  }

  console.log('\n❌ GAPS IDENTIFIED:');
  if (LLM_GAPS.length > 0) {
    console.log('   LLM Integration Gaps:');
    LLM_GAPS.forEach(gap => console.log(`      ${gap}`));
  }
  if (RAG_GAPS.length > 0) {
    console.log('   RAG Integration Gaps:');
    RAG_GAPS.forEach(gap => console.log(`      ${gap}`));
  }

  console.log('\n🎯 RECOMMENDATIONS TO REACH 100%:');
  
  if (auditResults.coverage.llmIntegration < 100) {
    console.log(`   1. Add LLM integration to ${auditResults.workers.total - auditResults.workers.withLLM} remaining workers`);
  }
  
  if (auditResults.coverage.ragSystem < 100) {
    console.log(`   2. Add RAG integration to ${auditResults.workers.total - auditResults.workers.withRAG} remaining workers`);
  }
  
  if (auditResults.coverage.bestPractices < 100) {
    console.log(`   3. Add best practices generation to ${auditResults.workers.total - auditResults.workers.withBestPractices} remaining workers`);
  }

  if (redundancies.duplicateImports.length > 5) {
    console.log(`   4. Consolidate ${redundancies.duplicateImports.length} duplicate imports into shared modules`);
  }

  if (redundancies.duplicateFunctions.length > 3) {
    console.log(`   5. Refactor ${redundancies.duplicateFunctions.length} duplicate functions into utilities`);
  }

  console.log('\n✨ Audit Complete!');
  
  return auditResults;
}

// Run the audit
runComprehensiveAudit().catch(console.error);