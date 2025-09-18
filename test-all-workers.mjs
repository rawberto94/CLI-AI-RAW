#!/usr/bin/env node

/**
 * Comprehensive Worker Testing Script
 * Tests all workers to identify issues and verify functionality
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔍 Starting comprehensive worker analysis...\n');

// Test 1: Check if all workers can be imported
console.log('📦 Testing worker imports...');
const workerFiles = [
  'template.worker.ts',
  'financial.worker.ts', 
  'enhanced-overview.worker.ts',
  'benchmark.worker.ts',
  'clauses.worker.ts',
  'compliance.worker.ts',
  'ingestion.worker.ts',
  'overview.worker.ts',
  'rates.worker.ts',
  'report.worker.ts',
  'risk.worker.ts',
  'search.worker.ts'
];

const workerPath = 'apps/workers';
const issues = [];

for (const file of workerFiles) {
  const fullPath = path.join(workerPath, file);
  if (fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Check for common issues
      const checks = {
        hasExportFunction: /export\s+(async\s+)?function\s+run\w+|export\s+const\s+\w+Worker|export\s+\{.*run\w+.*\}/.test(content),
        hasJobInterface: /Job|job\.data/.test(content),
        hasErrorHandling: /try\s*\{|catch\s*\(/.test(content),
        hasLogging: /console\.(log|warn|error)/.test(content),
        hasDatabase: /db\.|getDatabaseManager|getRepositoryManager/.test(content),
        hasLLMIntegration: /OpenAI|openai|LLM|gpt-/.test(content),
        hasBestPractices: /BestPractices|bestPractices/.test(content),
        hasProperImports: /import.*from/.test(content)
      };
      
      const failedChecks = Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([check]) => check);
      
      if (failedChecks.length > 0) {
        issues.push({
          file,
          type: 'structure',
          issues: failedChecks
        });
      }
      
      console.log(`  ✅ ${file} - Basic structure OK`);
      
    } catch (error) {
      issues.push({
        file,
        type: 'read_error',
        error: error.message
      });
      console.log(`  ❌ ${file} - Read error: ${error.message}`);
    }
  } else {
    issues.push({
      file,
      type: 'missing',
      error: 'File not found'
    });
    console.log(`  ❌ ${file} - File not found`);
  }
}

// Test 2: Check TypeScript compilation
console.log('\n🔨 Testing TypeScript compilation...');
try {
  execSync('npm run build', { cwd: workerPath, stdio: 'pipe' });
  console.log('  ✅ TypeScript compilation successful');
} catch (error) {
  console.log('  ❌ TypeScript compilation failed');
  console.log('  Error:', error.stdout?.toString() || error.message);
  issues.push({
    file: 'compilation',
    type: 'build_error',
    error: error.stdout?.toString() || error.message
  });
}

// Test 3: Check worker integration in index.ts
console.log('\n🔗 Testing worker integration...');
try {
  const indexContent = fs.readFileSync(path.join(workerPath, 'index.ts'), 'utf8');
  
  const expectedWorkers = [
    'runTemplate',
    'runFinancial', 
    'runIngestion',
    'runOverview',
    'runClauses',
    'runRates',
    'runRisk',
    'runBenchmark',
    'runReport',
    'runCompliance',
    'runSearch'
  ];
  
  const missingWorkers = expectedWorkers.filter(worker => 
    !indexContent.includes(worker)
  );
  
  if (missingWorkers.length > 0) {
    issues.push({
      file: 'index.ts',
      type: 'integration',
      issues: missingWorkers
    });
    console.log(`  ❌ Missing worker integrations: ${missingWorkers.join(', ')}`);
  } else {
    console.log('  ✅ All workers properly integrated');
  }
  
} catch (error) {
  console.log('  ❌ Failed to check worker integration');
  issues.push({
    file: 'index.ts',
    type: 'integration_error',
    error: error.message
  });
}

// Test 4: Check database integration
console.log('\n🗄️  Testing database integration...');
const dbIssues = [];
for (const file of workerFiles) {
  const fullPath = path.join(workerPath, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for new vs old database usage
    const hasNewDb = /getDatabaseManager|getRepositoryManager/.test(content);
    const hasOldDb = /require.*clients-db.*\.default/.test(content);
    const hasFallback = hasNewDb && hasOldDb;
    
    if (!hasNewDb && !hasOldDb) {
      dbIssues.push(`${file}: No database integration found`);
    } else if (hasOldDb && !hasNewDb) {
      dbIssues.push(`${file}: Using old database client only`);
    } else if (hasNewDb && !hasFallback) {
      dbIssues.push(`${file}: Missing fallback to old database client`);
    }
  }
}

if (dbIssues.length > 0) {
  console.log('  ⚠️  Database integration issues:');
  dbIssues.forEach(issue => console.log(`    - ${issue}`));
} else {
  console.log('  ✅ Database integration looks good');
}

// Test 5: Check enhanced-overview worker specifically
console.log('\n🔍 Testing enhanced-overview worker...');
const enhancedOverviewPath = path.join(workerPath, 'enhanced-overview.worker.ts');
if (fs.existsSync(enhancedOverviewPath)) {
  const content = fs.readFileSync(enhancedOverviewPath, 'utf8');
  
  const enhancedChecks = {
    hasWorkerClass: /class\s+EnhancedOverviewWorker/.test(content),
    hasProcessMethod: /async\s+process\s*\(/.test(content),
    hasExport: /export.*enhancedOverviewWorker/.test(content),
    hasIntegration: /enhancedOverviewWorker/.test(fs.readFileSync(path.join(workerPath, 'index.ts'), 'utf8'))
  };
  
  const enhancedIssues = Object.entries(enhancedChecks)
    .filter(([_, passed]) => !passed)
    .map(([check]) => check);
  
  if (enhancedIssues.length > 0) {
    console.log(`  ❌ Enhanced overview worker issues: ${enhancedIssues.join(', ')}`);
    issues.push({
      file: 'enhanced-overview.worker.ts',
      type: 'enhanced_worker',
      issues: enhancedIssues
    });
  } else {
    console.log('  ✅ Enhanced overview worker structure OK');
  }
} else {
  console.log('  ❌ Enhanced overview worker not found');
}

// Summary
console.log('\n📊 ANALYSIS SUMMARY');
console.log('==================');

if (issues.length === 0) {
  console.log('🎉 All workers appear to be working correctly!');
} else {
  console.log(`⚠️  Found ${issues.length} issues:`);
  console.log('\nISSUES BY CATEGORY:');
  
  const issuesByType = issues.reduce((acc, issue) => {
    acc[issue.type] = acc[issue.type] || [];
    acc[issue.type].push(issue);
    return acc;
  }, {});
  
  Object.entries(issuesByType).forEach(([type, typeIssues]) => {
    console.log(`\n${type.toUpperCase()}:`);
    typeIssues.forEach(issue => {
      console.log(`  - ${issue.file}: ${issue.error || issue.issues?.join(', ') || 'Unknown issue'}`);
    });
  });
  
  console.log('\n🔧 RECOMMENDED ACTIONS:');
  
  if (issuesByType.missing) {
    console.log('- Create missing worker files');
  }
  
  if (issuesByType.structure) {
    console.log('- Fix worker structure issues (missing exports, error handling, etc.)');
  }
  
  if (issuesByType.build_error) {
    console.log('- Fix TypeScript compilation errors');
  }
  
  if (issuesByType.integration) {
    console.log('- Update index.ts to properly integrate all workers');
  }
  
  if (issuesByType.enhanced_worker) {
    console.log('- Fix enhanced-overview worker integration');
  }
}

console.log('\n✨ Analysis complete!');