/**
 * End-to-End Artifact System Test
 * 
 * Tests the complete artifact generation pipeline:
 * 1. Contract upload simulation
 * 2. Artifact generation (all types)
 * 3. Validation
 * 4. Cost savings analysis
 * 5. Multi-pass refinement
 * 6. Table extraction
 */

import { parallelArtifactGeneratorService } from '../packages/data-orchestration/src/services/parallel-artifact-generator.service';
import { artifactValidationService } from '../packages/data-orchestration/src/services/artifact-validation.service';
import { costSavingsAnalyzerService } from '../packages/data-orchestration/src/services/cost-savings-analyzer.service';
import { multiPassGeneratorService } from '../packages/data-orchestration/src/services/multi-pass-generator.service';
import { tableExtractionService } from '../packages/data-orchestration/src/services/table-extraction.service';

// Sample contract text for testing
const SAMPLE_CONTRACT = `
PROFESSIONAL SERVICES AGREEMENT

This Agreement is made on January 1, 2024 between Acme Corporation (Client) 
and Tech Solutions LLC (Vendor).

TERM: This agreement shall be effective for 12 months from the effective date.

FINANCIAL TERMS:
Total Contract Value: $500,000
Payment Terms: Net 30 days
Monthly Retainer: $41,667

RATE CARD:
Role              | Level | Rate      | Unit
------------------|-------|-----------|------
Senior Developer  | L4    | $175/hour | hour
Junior Developer  | L2    | $125/hour | hour
Project Manager   | L5    | $200/hour | hour

PAYMENT SCHEDULE:
Milestone         | Amount    | Due Date
------------------|-----------|----------
Project Start     | $125,000  | 2024-01-15
Phase 1 Complete  | $187,500  | 2024-04-15
Phase 2 Complete  | $187,500  | 2024-08-15

TERMINATION: Either party may terminate this agreement with 30 days written notice.

CONFIDENTIALITY: All proprietary information must remain confidential for 2 years 
post-termination.

COMPLIANCE: Vendor must maintain SOC 2 Type II certification and comply with GDPR.
`;

interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  details?: any;
  error?: string;
}

class ArtifactSystemTester {
  private results: TestResult[] = [];
  private contractId = 'test-contract-001';
  private tenantId = 'test-tenant-001';

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting End-to-End Artifact System Test\n');
    console.log('=' .repeat(80));

    try {
      await this.testParallelGeneration();
      await this.testValidation();
      await this.testCostSavingsAnalysis();
      await this.testMultiPassGeneration();
      await this.testTableExtraction();
      
      this.printSummary();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    }
  }

  /**
   * Test 1: Parallel Artifact Generation
   */
  private async testParallelGeneration(): Promise<void> {
    console.log('\n📝 Test 1: Parallel Artifact Generation');
    console.log('-'.repeat(80));
    
    const startTime = Date.now();

    try {
      const result = await parallelArtifactGeneratorService.generateArtifactsParallel(
        SAMPLE_CONTRACT,
        this.contractId,
        this.tenantId,
        {
          artifactTypes: ['OVERVIEW', 'FINANCIAL', 'CLAUSES', 'RATES', 'COMPLIANCE', 'RISK'],
          maxConcurrent: 3
        }
      );

      const duration = Date.now() - startTime;

      console.log(`✅ Generated ${result.summary.successful} artifacts successfully`);
      console.log(`   Total time: ${duration}ms`);
      console.log(`   Average time per artifact: ${result.summary.averageProcessingTime.toFixed(0)}ms`);
      console.log(`   Consistency: ${result.consistencyResult?.consistent ? 'PASS' : 'FAIL'}`);

      // Print artifact details
      for (const [type, artifactResult] of result.results.entries()) {
        if (artifactResult.success) {
          console.log(`   ✓ ${type}: confidence=${(artifactResult.confidence || 0).toFixed(2)}, completeness=${artifactResult.completeness || 0}%`);
        } else {
          console.log(`   ✗ ${type}: ${artifactResult.error}`);
        }
      }

      this.results.push({
        step: 'Parallel Generation',
        success: result.success,
        duration,
        details: {
          artifactsGenerated: result.summary.successful,
          avgConfidence: this.calculateAvgConfidence(result.results),
          consistent: result.consistencyResult?.consistent
        }
      });

      // Store results for next tests
      (this as any).generatedArtifacts = result.results;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.results.push({
        step: 'Parallel Generation',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 2: Validation
   */
  private async testValidation(): Promise<void> {
    console.log('\n🔍 Test 2: Artifact Validation');
    console.log('-'.repeat(80));
    
    const startTime = Date.now();

    try {
      const artifacts = (this as any).generatedArtifacts;
      if (!artifacts) {
        throw new Error('No artifacts available for validation');
      }

      let totalIssues = 0;
      let totalAutoFixed = 0;

      for (const [type, result] of artifacts.entries()) {
        if (result.success && result.data) {
          const validation = artifactValidationService.validateArtifact(type, result.data);
          
          console.log(`   ${type}:`);
          console.log(`     Valid: ${validation.valid ? 'YES' : 'NO'}`);
          console.log(`     Completeness: ${validation.completeness}%`);
          console.log(`     Issues: ${validation.issues.length} (${validation.criticalIssues} critical, ${validation.warnings} warnings)`);

          totalIssues += validation.issues.length;

          // Test auto-fix
          if (!validation.valid && validation.canAutoFix) {
            const fixResult = artifactValidationService.autoFix(result.data, validation.issues);
            if (fixResult.fixed) {
              console.log(`     Auto-fixed: ${fixResult.changes.length} issues`);
              totalAutoFixed += fixResult.changes.length;
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(`\n✅ Validation complete`);
      console.log(`   Total issues found: ${totalIssues}`);
      console.log(`   Auto-fixed: ${totalAutoFixed}`);

      this.results.push({
        step: 'Validation',
        success: true,
        duration,
        details: {
          totalIssues,
          autoFixed: totalAutoFixed
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.results.push({
        step: 'Validation',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 3: Cost Savings Analysis
   */
  private async testCostSavingsAnalysis(): Promise<void> {
    console.log('\n💰 Test 3: Cost Savings Analysis');
    console.log('-'.repeat(80));
    
    const startTime = Date.now();

    try {
      const artifacts = (this as any).generatedArtifacts;
      if (!artifacts) {
        throw new Error('No artifacts available for cost savings analysis');
      }

      // Convert Map to object
      const artifactsObj: any = {};
      for (const [type, result] of artifacts.entries()) {
        if (result.success && result.data) {
          artifactsObj[type.toLowerCase()] = result.data;
        }
      }

      const analysis = await costSavingsAnalyzerService.analyzeCostSavings(artifactsObj);

      const duration = Date.now() - startTime;

      console.log(`✅ Cost savings analysis complete`);
      console.log(`   Total potential savings: ${analysis.totalPotentialSavings.currency} ${analysis.totalPotentialSavings.amount.toLocaleString()}`);
      console.log(`   Percentage: ${analysis.totalPotentialSavings.percentage.toFixed(1)}%`);
      console.log(`   Opportunities: ${analysis.opportunities.length}`);
      console.log(`   Quick wins: ${analysis.quickWins.length}`);
      console.log(`   Strategic initiatives: ${analysis.strategicInitiatives.length}`);
      console.log(`   High confidence: ${analysis.summary.highConfidenceOpportunities}`);

      // Print top 3 opportunities
      console.log('\n   Top 3 Opportunities:');
      analysis.opportunities.slice(0, 3).forEach((opp, idx) => {
        console.log(`     ${idx + 1}. ${opp.title}`);
        console.log(`        Savings: ${opp.potentialSavings.currency} ${opp.potentialSavings.amount.toLocaleString()}`);
        console.log(`        Confidence: ${opp.confidence}, Effort: ${opp.effort}`);
      });

      this.results.push({
        step: 'Cost Savings Analysis',
        success: true,
        duration,
        details: {
          totalSavings: analysis.totalPotentialSavings.amount,
          opportunities: analysis.opportunities.length,
          quickWins: analysis.quickWins.length
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.results.push({
        step: 'Cost Savings Analysis',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 4: Multi-Pass Generation
   */
  private async testMultiPassGeneration(): Promise<void> {
    console.log('\n🔄 Test 4: Multi-Pass Generation');
    console.log('-'.repeat(80));
    
    const startTime = Date.now();

    try {
      const result = await multiPassGeneratorService.generateMultiPass(
        'FINANCIAL',
        SAMPLE_CONTRACT,
        this.contractId,
        this.tenantId,
        {
          maxPasses: 3,
          targetCompleteness: 85,
          targetConfidence: 0.85
        }
      );

      const duration = Date.now() - startTime;

      console.log(`✅ Multi-pass generation complete`);
      console.log(`   Passes executed: ${result.passes.length}`);
      console.log(`   Initial completeness: ${result.improvementSummary.initialCompleteness}%`);
      console.log(`   Final completeness: ${result.improvementSummary.finalCompleteness}%`);
      console.log(`   Improvement: +${result.improvementSummary.improvement}%`);
      console.log(`   Final confidence: ${(result.finalConfidence || 0).toFixed(2)}`);

      // Print pass details
      result.passes.forEach((pass, idx) => {
        console.log(`\n   Pass ${pass.passNumber} (${pass.method}):`);
        console.log(`     Completeness: ${pass.completeness}%`);
        console.log(`     Improvements: ${pass.improvements.length}`);
        pass.improvements.forEach(imp => console.log(`       - ${imp}`));
      });

      this.results.push({
        step: 'Multi-Pass Generation',
        success: result.success,
        duration,
        details: {
          passes: result.passes.length,
          improvement: result.improvementSummary.improvement,
          finalCompleteness: result.improvementSummary.finalCompleteness
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.results.push({
        step: 'Multi-Pass Generation',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test 5: Table Extraction
   */
  private async testTableExtraction(): Promise<void> {
    console.log('\n📊 Test 5: Table Extraction');
    console.log('-'.repeat(80));
    
    const startTime = Date.now();

    try {
      // Detect tables
      const tables = tableExtractionService.detectTables(SAMPLE_CONTRACT);
      console.log(`   Detected ${tables.length} tables`);

      // Extract rate cards
      const rateCards = tableExtractionService.extractRateCards(tables);
      console.log(`\n   Rate Cards: ${rateCards.length}`);
      rateCards.forEach(card => {
        console.log(`     - ${card.role}: ${card.currency} ${card.rate}/${card.unit}`);
      });

      // Extract payment schedule
      const paymentSchedule = tableExtractionService.extractPaymentSchedule(tables);
      console.log(`\n   Payment Schedule: ${paymentSchedule.length} items`);
      paymentSchedule.forEach(item => {
        console.log(`     - ${item.milestone}: ${item.currency} ${item.amount.toLocaleString()}`);
      });

      const duration = Date.now() - startTime;

      console.log(`\n✅ Table extraction complete`);

      this.results.push({
        step: 'Table Extraction',
        success: true,
        duration,
        details: {
          tablesDetected: tables.length,
          rateCards: rateCards.length,
          paymentItems: paymentSchedule.length
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.results.push({
        step: 'Table Extraction',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : ''}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    console.log('\nDetailed Results:');
    this.results.forEach((result, idx) => {
      const status = result.success ? '✅' : '❌';
      console.log(`\n${idx + 1}. ${status} ${result.step}`);
      console.log(`   Duration: ${result.duration}ms`);
      if (result.details) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2).split('\n').map(l => `     ${l}`).join('\n'));
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    
    if (failedTests === 0) {
      console.log('🎉 ALL TESTS PASSED!');
    } else {
      console.log(`⚠️  ${failedTests} TEST(S) FAILED`);
    }
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Calculate average confidence from results
   */
  private calculateAvgConfidence(results: Map<any, any>): number {
    let total = 0;
    let count = 0;

    for (const result of results.values()) {
      if (result.success && result.confidence !== undefined) {
        total += result.confidence;
        count++;
      }
    }

    return count > 0 ? total / count : 0;
  }
}

// Run tests
async function main() {
  const tester = new ArtifactSystemTester();
  
  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { ArtifactSystemTester };
