#!/usr/bin/env node
/**
 * Analyze Contract ID Issues
 * Check how many contracts have invalid IDs
 */

async function analyzeContractIds() {
  console.log('🔍 ANALYZING CONTRACT ID ISSUES');
  console.log('================================\n');

  const API_BASE = 'http://localhost:3001/api';
  const TENANT_ID = 'demo';

  try {
    // Get all contracts
    const response = await fetch(`${API_BASE}/contracts`, {
      headers: { 'x-tenant-id': TENANT_ID }
    });

    if (!response.ok) {
      console.log('❌ Cannot fetch contracts');
      return;
    }

    const contracts = await response.json();
    const contractList = Array.isArray(contracts) ? contracts : (contracts?.items || []);
    
    console.log(`📋 Total contracts: ${contractList.length}\n`);

    // Analyze contract ID patterns
    const validPattern = /^doc-\d{13}-[a-f0-9]{6}$/;
    const relaxedPattern = /^doc-\d{13}-[a-zA-Z0-9]{6}$/;
    
    let validIds = 0;
    let invalidButAcceptable = 0;
    let completelyInvalid = 0;
    const invalidExamples = [];
    const invalidButAcceptableExamples = [];

    for (const contract of contractList) {
      const id = contract.id;
      
      if (validPattern.test(id)) {
        validIds++;
      } else if (relaxedPattern.test(id)) {
        invalidButAcceptable++;
        if (invalidButAcceptableExamples.length < 10) {
          invalidButAcceptableExamples.push({
            id,
            name: contract.name || 'unnamed',
            issue: id.match(/[g-zG-Z]/g)?.join('') || 'unknown'
          });
        }
      } else {
        completelyInvalid++;
        if (invalidExamples.length < 10) {
          invalidExamples.push({
            id,
            name: contract.name || 'unnamed'
          });
        }
      }
    }

    // Report results
    console.log('📊 CONTRACT ID ANALYSIS RESULTS');
    console.log('===============================');
    console.log(`✅ Valid IDs (strict hex):     ${validIds} (${(validIds/contractList.length*100).toFixed(1)}%)`);
    console.log(`⚠️  Invalid but acceptable:    ${invalidButAcceptable} (${(invalidButAcceptable/contractList.length*100).toFixed(1)}%)`);
    console.log(`❌ Completely invalid:         ${completelyInvalid} (${(completelyInvalid/contractList.length*100).toFixed(1)}%)`);

    if (invalidButAcceptableExamples.length > 0) {
      console.log('\n⚠️  INVALID BUT ACCEPTABLE IDs (fixed by our API change):');
      invalidButAcceptableExamples.forEach(example => {
        console.log(`   - ${example.id} (${example.name}) - contains: ${example.issue}`);
      });
    }

    if (invalidExamples.length > 0) {
      console.log('\n❌ COMPLETELY INVALID IDs (would still cause issues):');
      invalidExamples.forEach(example => {
        console.log(`   - ${example.id} (${example.name})`);
      });
    }

    // Test a few random contracts
    console.log('\n🧪 TESTING RANDOM CONTRACT ACCESS:');
    const testContracts = contractList.slice(0, 5);
    
    for (const contract of testContracts) {
      try {
        const artifactResponse = await fetch(`${API_BASE}/contracts/${contract.id}/artifacts/overview.json`, {
          headers: { 'x-tenant-id': TENANT_ID }
        });
        
        const status = artifactResponse.ok ? '✅' : '❌';
        console.log(`   ${status} ${contract.id} - ${artifactResponse.status} ${artifactResponse.statusText}`);
      } catch (error) {
        console.log(`   ❌ ${contract.id} - Network error: ${error.message}`);
      }
    }

    // Summary and recommendations
    console.log('\n💡 SUMMARY & RECOMMENDATIONS');
    console.log('============================');
    
    if (invalidButAcceptable === 0 && completelyInvalid === 0) {
      console.log('🎉 All contract IDs are valid! No issues found.');
    } else if (completelyInvalid === 0) {
      console.log(`✅ Good news: Our API fix resolves all ${invalidButAcceptable} problematic contracts.`);
      console.log('   All contracts should now work properly in your demo.');
    } else {
      console.log(`⚠️  Our API fix resolves ${invalidButAcceptable} contracts.`);
      console.log(`❌ However, ${completelyInvalid} contracts still have completely invalid IDs.`);
      console.log('   These may need manual fixing or a more comprehensive solution.');
    }

    console.log('\n🚀 DEMO READINESS:');
    const workingContracts = validIds + invalidButAcceptable;
    const workingPercentage = (workingContracts / contractList.length * 100).toFixed(1);
    console.log(`   ${workingContracts}/${contractList.length} contracts (${workingPercentage}%) should work in your demo.`);
    
    if (workingPercentage >= 95) {
      console.log('   🎯 Excellent! Your demo should work smoothly.');
    } else if (workingPercentage >= 80) {
      console.log('   👍 Good! Most contracts will work, minor issues possible.');
    } else {
      console.log('   ⚠️  Significant issues detected. Consider additional fixes.');
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

// Run the analysis
analyzeContractIds();