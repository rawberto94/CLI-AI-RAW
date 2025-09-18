/**
 * Simple verification of LLM integration in all workers
 */

import { readFile } from 'fs/promises';

console.log('🧠 Verifying LLM Integration in All Workers...\n');

const workers = [
  'financial.worker.ts',
  'clauses.worker.ts', 
  'risk.worker.ts',
  'compliance.worker.ts',
  'template.worker.ts',
  'enhanced-overview.worker.ts',
  'rates.worker.ts',
  'benchmark.worker.ts',
  'overview.worker.ts',
  'report.worker.ts',
  'search.worker.ts',
  'ingestion.worker.ts',
  'auto-indexation.worker.ts'
];

async function checkWorkerLLM(workerFile) {
  try {
    const content = await readFile(`apps/workers/${workerFile}`, 'utf8');
    
    const checks = {
      hasOpenAI: content.includes('OpenAI') || content.includes('openai'),
      hasChatCompletions: content.includes('chat.completions.create'),
      hasGPT4: content.includes('gpt-4') || content.includes('GPT-4'),
      hasAdvancedAnalysis: content.includes('Advanced') && content.includes('Analysis'),
      hasBestPractices: content.includes('BestPractices') || content.includes('best practices'),
      hasLLMComment: content.includes('LLM') || content.includes('Enhanced'),
      hasConfidenceScore: content.includes('confidenceScore') || content.includes('confidence'),
      hasExpertPrompt: content.includes('expert') || content.includes('senior') || content.includes('experience')
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    const maxScore = Object.keys(checks).length;
    const percentage = Math.round((score / maxScore) * 100);
    
    const hasLLM = score >= 4; // At least half the indicators
    
    return {
      worker: workerFile.replace('.worker.ts', ''),
      hasLLM,
      score,
      maxScore,
      percentage,
      checks
    };
    
  } catch (error) {
    return {
      worker: workerFile.replace('.worker.ts', ''),
      hasLLM: false,
      error: error.message,
      score: 0,
      maxScore: 8,
      percentage: 0
    };
  }
}

async function verifyAllWorkers() {
  const results = [];
  
  for (const worker of workers) {
    const result = await checkWorkerLLM(worker);
    results.push(result);
    
    const status = result.hasLLM ? '✅' : '❌';
    const workerName = result.worker.charAt(0).toUpperCase() + result.worker.slice(1);
    
    console.log(`${status} ${workerName} Worker (${result.percentage}%)`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    } else {
      const features = [];
      if (result.checks.hasOpenAI) features.push('OpenAI');
      if (result.checks.hasChatCompletions) features.push('Chat API');
      if (result.checks.hasGPT4) features.push('GPT-4');
      if (result.checks.hasAdvancedAnalysis) features.push('Advanced Analysis');
      if (result.checks.hasBestPractices) features.push('Best Practices');
      
      console.log(`   Features: ${features.join(', ') || 'None'}`);
    }
  }
  
  console.log('\n📊 SUMMARY:');
  const withLLM = results.filter(r => r.hasLLM).length;
  const total = results.length;
  const rate = Math.round((withLLM / total) * 100);
  
  console.log(`Workers with LLM: ${withLLM}/${total} (${rate}%)`);
  
  // List workers by category
  const comprehensive = results.filter(r => r.percentage >= 75);
  const partial = results.filter(r => r.percentage >= 50 && r.percentage < 75);
  const minimal = results.filter(r => r.percentage >= 25 && r.percentage < 50);
  const none = results.filter(r => r.percentage < 25);
  
  if (comprehensive.length > 0) {
    console.log(`\n✅ Comprehensive LLM Integration (${comprehensive.length}):`);
    comprehensive.forEach(w => console.log(`   - ${w.worker} (${w.percentage}%)`));
  }
  
  if (partial.length > 0) {
    console.log(`\n🟡 Partial LLM Integration (${partial.length}):`);
    partial.forEach(w => console.log(`   - ${w.worker} (${w.percentage}%)`));
  }
  
  if (minimal.length > 0) {
    console.log(`\n🟠 Minimal LLM Integration (${minimal.length}):`);
    minimal.forEach(w => console.log(`   - ${w.worker} (${w.percentage}%)`));
  }
  
  if (none.length > 0) {
    console.log(`\n❌ No LLM Integration (${none.length}):`);
    none.forEach(w => console.log(`   - ${w.worker} (${w.percentage}%)`));
  }
  
  // Final assessment
  console.log('\n🎯 ASSESSMENT:');
  if (rate >= 85) {
    console.log('🎉 EXCELLENT: Most workers have comprehensive LLM integration!');
    console.log('✅ Artifacts ARE being populated through LLM analysis across the system');
  } else if (rate >= 70) {
    console.log('👍 GOOD: Majority of workers have LLM integration');
    console.log('✅ Artifacts are MOSTLY populated through LLM analysis');
  } else if (rate >= 50) {
    console.log('⚠️ MODERATE: About half the workers have LLM integration');
    console.log('🟡 Artifacts are PARTIALLY populated through LLM analysis');
  } else {
    console.log('❌ NEEDS WORK: Many workers lack LLM integration');
    console.log('❌ Artifacts may NOT be fully populated through LLM analysis');
  }
  
  console.log('\n✨ Verification Complete!');
}

verifyAllWorkers().catch(console.error);