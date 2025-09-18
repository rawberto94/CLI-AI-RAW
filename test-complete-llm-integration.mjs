/**
 * Comprehensive test to verify ALL workers have LLM integration
 */

import { readFile } from 'fs/promises';

console.log('🧠 Testing Complete LLM Integration Across All Workers...');

// Complete list of all workers
const allWorkers = [
  { name: 'Financial', file: 'apps/workers/financial.worker.ts', priority: 'HIGH' },
  { name: 'Clauses', file: 'apps/workers/clauses.worker.ts', priority: 'HIGH' },
  { name: 'Risk', file: 'apps/workers/risk.worker.ts', priority: 'HIGH' },
  { name: 'Compliance', file: 'apps/workers/compliance.worker.ts', priority: 'HIGH' },
  { name: 'Template', file: 'apps/workers/template.worker.ts', priority: 'HIGH' },
  { name: 'Enhanced Overview', file: 'apps/workers/enhanced-overview.worker.ts', priority: 'HIGH' },
  { name: 'Rates', file: 'apps/workers/rates.worker.ts', priority: 'MEDIUM' },
  { name: 'Benchmark', file: 'apps/workers/benchmark.worker.ts', priority: 'MEDIUM' },
  { name: 'Overview', file: 'apps/workers/overview.worker.ts', priority: 'MEDIUM' },
  { name: 'Report', file: 'apps/workers/report.worker.ts', priority: 'MEDIUM' },
  { name: 'Search', file: 'apps/workers/search.worker.ts', priority: 'LOW' },
  { name: 'Ingestion', file: 'apps/workers/ingestion.worker.ts', priority: 'LOW' },
  { name: 'Auto-Indexation', file: 'apps/workers/auto-indexation.worker.ts', priority: 'MEDIUM' }
];

// LLM integration indicators to check for
const llmIndicators = {
  // Modern OpenAI integration
  modernOpenAI: {
    patterns: ['new OpenAI({', 'OpenAI = require(\'openai\').OpenAI'],
    weight: 10,
    description: 'Modern OpenAI client integration'
  },
  
  // Chat completions API
  chatCompletions: {
    patterns: ['chat.completions.create', 'chat\.completions\.create'],
    weight: 10,
    description: 'Modern chat completions API usage'
  },
  
  // GPT-4 model usage
  gpt4Usage: {
    patterns: ['gpt-4o', 'GPT-4', 'gpt-4'],
    weight: 8,
    description: 'GPT-4 model specification'
  },
  
  // Advanced analysis functions
  advancedAnalysis: {
    patterns: ['performAdvanced.*Analysis', 'Advanced.*Analysis', 'comprehensive.*analysis'],
    weight: 8,
    description: 'Advanced LLM analysis functions'
  },
  
  // Best practices generation
  bestPractices: {
    patterns: ['BestPractices', 'best practices', 'generateBestPractices', 'generate.*BestPractices'],
    weight: 7,
    description: 'AI-powered best practices generation'
  },
  
  // Expert prompts and personas
  expertPrompts: {
    patterns: ['senior.*expert', 'years of experience', 'expert.*analysis', 'professional.*experience'],
    weight: 6,
    description: 'Expert-level AI prompts and personas'
  },
  
  // Confidence scoring
  confidenceScoring: {
    patterns: ['confidenceScore', 'confidence.*score', 'overallConfidence'],
    weight: 5,
    description: 'AI confidence scoring implementation'
  },
  
  // Structured output
  structuredOutput: {
    patterns: ['JSON.parse', 'jsonMatch', 'structured.*output', 'response.*parsing'],
    weight: 4,
    description: 'Structured LLM output parsing'
  },
  
  // Fallback mechanisms
  fallbackMechanisms: {
    patterns: ['fallback.*analysis', 'heuristic.*analysis', 'LLM.*fail'],
    weight: 3,
    description: 'Fallback mechanisms for LLM failures'
  },
  
  // Environment configuration
  envConfig: {
    patterns: ['OPENAI_API_KEY', 'OPENAI_MODEL', 'process.env'],
    weight: 2,
    description: 'Environment configuration for LLM'
  }
};

// Analyze worker LLM integration
async function analyzeWorkerLLM(worker) {
  try {
    const content = await readFile(worker.file, 'utf8');
    
    const analysis = {
      worker: worker.name,
      priority: worker.priority,
      indicators: {},
      totalScore: 0,
      maxScore: 0,
      hasLLM: false,
      integrationLevel: 'NONE',
      recommendations: []
    };
    
    // Check each indicator
    for (const [indicatorName, indicator] of Object.entries(llmIndicators)) {
      const found = indicator.patterns.some(pattern => {
        const regex = new RegExp(pattern, 'gi');
        return regex.test(content);
      });
      
      analysis.indicators[indicatorName] = {
        found,
        weight: indicator.weight,
        description: indicator.description
      };
      
      if (found) {
        analysis.totalScore += indicator.weight;
      }
      analysis.maxScore += indicator.weight;
    }
    
    // Determine integration level
    const percentage = (analysis.totalScore / analysis.maxScore) * 100;
    
    if (percentage >= 80) {
      analysis.integrationLevel = 'COMPREHENSIVE';
      analysis.hasLLM = true;
    } else if (percentage >= 60) {
      analysis.integrationLevel = 'ADVANCED';
      analysis.hasLLM = true;
    } else if (percentage >= 40) {
      analysis.integrationLevel = 'MODERATE';
      analysis.hasLLM = true;
    } else if (percentage >= 20) {
      analysis.integrationLevel = 'BASIC';
      analysis.hasLLM = true;
    } else {
      analysis.integrationLevel = 'NONE';
      analysis.hasLLM = false;
    }
    
    // Generate recommendations
    if (!analysis.indicators.modernOpenAI.found) {
      analysis.recommendations.push('Upgrade to modern OpenAI client');
    }
    if (!analysis.indicators.chatCompletions.found) {
      analysis.recommendations.push('Implement chat completions API');
    }
    if (!analysis.indicators.advancedAnalysis.found) {
      analysis.recommendations.push('Add advanced LLM analysis functions');
    }
    if (!analysis.indicators.bestPractices.found) {
      analysis.recommendations.push('Implement best practices generation');
    }
    if (!analysis.indicators.confidenceScoring.found) {
      analysis.recommendations.push('Add confidence scoring');
    }
    
    return analysis;
    
  } catch (error) {
    return {
      worker: worker.name,
      priority: worker.priority,
      error: error.message,
      hasLLM: false,
      integrationLevel: 'ERROR',
      totalScore: 0,
      maxScore: 0
    };
  }
}

// Generate comprehensive report
async function generateComprehensiveReport() {
  console.log('🔍 Analyzing LLM Integration Across All Workers...\n');
  
  const results = [];
  
  for (const worker of allWorkers) {
    const analysis = await analyzeWorkerLLM(worker);
    results.push(analysis);
    
    // Display individual results
    const status = analysis.hasLLM ? '✅' : '❌';
    const level = analysis.integrationLevel;
    const score = `${analysis.totalScore}/${analysis.maxScore}`;
    const percentage = Math.round((analysis.totalScore / analysis.maxScore) * 100);
    
    console.log(`${status} ${worker.name} Worker [${worker.priority}]`);
    console.log(`   Integration Level: ${level} (${score} points, ${percentage}%)`);
    
    if (analysis.error) {
      console.log(`   ❌ Error: ${analysis.error}`);
    } else {
      // Show key indicators
      const keyIndicators = ['modernOpenAI', 'chatCompletions', 'advancedAnalysis', 'bestPractices'];
      const foundIndicators = keyIndicators.filter(key => analysis.indicators[key]?.found);
      console.log(`   Key Features: ${foundIndicators.join(', ') || 'None'}`);
      
      if (analysis.recommendations.length > 0) {
        console.log(`   Recommendations: ${analysis.recommendations.slice(0, 2).join(', ')}`);
      }
    }
    console.log('');
  }
  
  return results;
}

// Generate summary statistics
function generateSummaryStats(results) {
  console.log('📊 COMPREHENSIVE LLM INTEGRATION SUMMARY');
  console.log('==========================================\n');
  
  // Overall statistics
  const totalWorkers = results.length;
  const workersWithLLM = results.filter(r => r.hasLLM).length;
  const workersWithoutLLM = totalWorkers - workersWithLLM;
  
  console.log(`Total Workers Analyzed: ${totalWorkers}`);
  console.log(`Workers with LLM Integration: ${workersWithLLM}`);
  console.log(`Workers without LLM Integration: ${workersWithoutLLM}`);
  console.log(`Overall Integration Rate: ${Math.round((workersWithLLM / totalWorkers) * 100)}%\n`);
  
  // By priority
  const priorities = ['HIGH', 'MEDIUM', 'LOW'];
  priorities.forEach(priority => {
    const priorityWorkers = results.filter(r => r.priority === priority);
    const priorityWithLLM = priorityWorkers.filter(r => r.hasLLM).length;
    const priorityRate = Math.round((priorityWithLLM / priorityWorkers.length) * 100);
    
    console.log(`${priority} Priority Workers: ${priorityWithLLM}/${priorityWorkers.length} (${priorityRate}%)`);
  });
  
  console.log('');
  
  // By integration level
  const levels = ['COMPREHENSIVE', 'ADVANCED', 'MODERATE', 'BASIC', 'NONE', 'ERROR'];
  levels.forEach(level => {
    const levelWorkers = results.filter(r => r.integrationLevel === level);
    if (levelWorkers.length > 0) {
      const levelNames = levelWorkers.map(r => r.worker).join(', ');
      console.log(`${level}: ${levelWorkers.length} workers (${levelNames})`);
    }
  });
  
  console.log('');
  
  // Top performers
  const topPerformers = results
    .filter(r => r.integrationLevel === 'COMPREHENSIVE' || r.integrationLevel === 'ADVANCED')
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);
    
  if (topPerformers.length > 0) {
    console.log('🏆 TOP LLM INTEGRATION PERFORMERS:');
    topPerformers.forEach((worker, index) => {
      const percentage = Math.round((worker.totalScore / worker.maxScore) * 100);
      console.log(`${index + 1}. ${worker.worker} (${percentage}% - ${worker.integrationLevel})`);
    });
    console.log('');
  }
  
  // Workers needing attention
  const needsAttention = results
    .filter(r => r.integrationLevel === 'NONE' || r.integrationLevel === 'BASIC' || r.integrationLevel === 'ERROR')
    .sort((a, b) => a.totalScore - b.totalScore);
    
  if (needsAttention.length > 0) {
    console.log('⚠️ WORKERS NEEDING LLM INTEGRATION:');
    needsAttention.forEach(worker => {
      const percentage = Math.round((worker.totalScore / worker.maxScore) * 100);
      console.log(`- ${worker.worker} (${percentage}% - ${worker.integrationLevel})`);
      if (worker.recommendations.length > 0) {
        console.log(`  Recommendations: ${worker.recommendations.slice(0, 3).join(', ')}`);
      }
    });
    console.log('');
  }
  
  // Feature adoption
  console.log('🔧 FEATURE ADOPTION ACROSS WORKERS:');
  Object.entries(llmIndicators).forEach(([feature, indicator]) => {
    const adoption = results.filter(r => r.indicators?.[feature]?.found).length;
    const adoptionRate = Math.round((adoption / totalWorkers) * 100);
    console.log(`${indicator.description}: ${adoption}/${totalWorkers} (${adoptionRate}%)`);
  });
  
  console.log('');
  
  // Final assessment
  if (workersWithLLM >= totalWorkers * 0.9) {
    console.log('🎉 EXCELLENT: Nearly all workers have LLM integration!');
  } else if (workersWithLLM >= totalWorkers * 0.7) {
    console.log('👍 GOOD: Most workers have LLM integration, some need enhancement');
  } else if (workersWithLLM >= totalWorkers * 0.5) {
    console.log('⚠️ MODERATE: About half the workers have LLM integration');
  } else {
    console.log('❌ NEEDS WORK: Many workers are missing LLM integration');
  }
  
  console.log('\n✨ Complete LLM Integration Analysis Finished!');
}

// Run the comprehensive analysis
async function runCompleteAnalysis() {
  try {
    const results = await generateComprehensiveReport();
    generateSummaryStats(results);
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

runCompleteAnalysis();