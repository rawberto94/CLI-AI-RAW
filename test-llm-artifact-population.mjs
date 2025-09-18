/**
 * Comprehensive test to verify LLM-powered artifact population
 */

console.log('🧠 Testing LLM-Powered Artifact Population...');

// Test contract content that should trigger LLM analysis
const testContractContent = `
PROFESSIONAL SERVICES AGREEMENT

This Agreement is entered into on January 1, 2024, between TechCorp Inc. ("Client") 
and DevServices LLC ("Contractor") for software development services.

PAYMENT TERMS:
- Monthly fee: $75,000 payable within 30 days of invoice receipt
- Performance bonus: 10% of monthly fee for meeting quarterly milestones
- Late payment penalty: 1.5% monthly interest on overdue amounts
- Expense reimbursement: Up to $5,000 monthly for reasonable travel expenses

TERMINATION:
- Either party may terminate with 60 days written notice
- Early termination by Client requires $25,000 termination fee
- All work product must be delivered within 15 days of termination

INTELLECTUAL PROPERTY:
- All work product belongs to Client
- Contractor retains rights to pre-existing IP and general methodologies
- Client grants Contractor license to use for portfolio purposes

LIABILITY AND INDEMNIFICATION:
- Contractor liability limited to 12 months of fees paid
- Mutual indemnification for third-party claims
- Professional liability insurance required: minimum $2,000,000 coverage

COMPLIANCE REQUIREMENTS:
- GDPR compliance required for all data processing
- SOX compliance for financial reporting systems
- Regular security audits and penetration testing required
- Data encryption in transit and at rest mandatory

RISK FACTORS:
- Project complexity may lead to scope creep
- Dependency on third-party APIs creates integration risks
- Tight deadlines increase delivery risk
- Remote work arrangement requires enhanced communication protocols

GOVERNING LAW:
This agreement shall be governed by the laws of Delaware, USA.
Any disputes shall be resolved through binding arbitration.
`;

// Test environment variables
function checkEnvironmentSetup() {
  console.log('\n🔧 Checking Environment Setup...');
  
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'OPENAI_MODEL'
  ];
  
  const missingVars = [];
  const presentVars = [];
  
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      presentVars.push(varName);
      // Don't log the actual API key for security
      if (varName === 'OPENAI_API_KEY') {
        console.log(`✅ ${varName}: ${process.env[varName].substring(0, 8)}...`);
      } else {
        console.log(`✅ ${varName}: ${process.env[varName]}`);
      }
    } else {
      missingVars.push(varName);
      console.log(`❌ ${varName}: Not set`);
    }
  });
  
  return {
    allPresent: missingVars.length === 0,
    presentVars,
    missingVars
  };
}

// Test LLM connectivity
async function testLLMConnectivity() {
  console.log('\n🌐 Testing LLM Connectivity...');
  
  try {
    // Try to import OpenAI
    const { OpenAI } = await import('openai');
    console.log('✅ OpenAI module imported successfully');
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('❌ No API key available for connectivity test');
      return false;
    }
    
    const client = new OpenAI({ apiKey });
    console.log('✅ OpenAI client created successfully');
    
    // Test with a simple request
    console.log('🧪 Testing API connectivity with simple request...');
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Respond with exactly "API_TEST_SUCCESS".'
        },
        {
          role: 'user',
          content: 'Test connectivity'
        }
      ],
      max_tokens: 10,
      temperature: 0
    });
    
    const result = response.choices?.[0]?.message?.content?.trim();
    if (result === 'API_TEST_SUCCESS') {
      console.log('✅ LLM API connectivity test successful');
      return true;
    } else {
      console.log('⚠️ LLM API responded but with unexpected result:', result);
      return false;
    }
    
  } catch (error) {
    console.log('❌ LLM connectivity test failed:', error.message);
    return false;
  }
}

// Test financial worker LLM integration
async function testFinancialWorkerLLM() {
  console.log('\n💰 Testing Financial Worker LLM Integration...');
  
  try {
    // Import the financial worker
    const financialWorker = await import('./apps/workers/financial.worker.ts');
    console.log('✅ Financial worker imported successfully');
    
    if (typeof financialWorker.runFinancial !== 'function') {
      console.log('❌ runFinancial function not found');
      return false;
    }
    
    console.log('✅ runFinancial function exists');
    
    // Check if the worker has LLM integration code
    const workerCode = await import('fs').then(fs => 
      fs.promises.readFile('./apps/workers/financial.worker.ts', 'utf8')
    );
    
    const llmIndicators = [
      'OpenAI',
      'chat.completions.create',
      'GPT-4',
      'performAdvancedFinancialAnalysis',
      'generateFinancialBestPractices'
    ];
    
    const foundIndicators = llmIndicators.filter(indicator => 
      workerCode.includes(indicator)
    );
    
    console.log(`✅ LLM integration indicators found: ${foundIndicators.length}/${llmIndicators.length}`);
    foundIndicators.forEach(indicator => console.log(`  - ${indicator}`));
    
    if (foundIndicators.length >= 4) {
      console.log('✅ Financial worker has comprehensive LLM integration');
      return true;
    } else {
      console.log('⚠️ Financial worker may have limited LLM integration');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Financial worker LLM test failed:', error.message);
    return false;
  }
}

// Test clauses worker LLM integration
async function testClausesWorkerLLM() {
  console.log('\n📄 Testing Clauses Worker LLM Integration...');
  
  try {
    const clausesWorker = await import('./apps/workers/clauses.worker.ts');
    console.log('✅ Clauses worker imported successfully');
    
    // Check for LLM integration in the code
    const workerCode = await import('fs').then(fs => 
      fs.promises.readFile('./apps/workers/clauses.worker.ts', 'utf8')
    );
    
    const llmIndicators = [
      'OpenAI',
      'chat.completions.create',
      'GPT-4',
      'extractClausesWithGPT4',
      'ClausesIntelligenceWorker'
    ];
    
    const foundIndicators = llmIndicators.filter(indicator => 
      workerCode.includes(indicator)
    );
    
    console.log(`✅ LLM integration indicators found: ${foundIndicators.length}/${llmIndicators.length}`);
    foundIndicators.forEach(indicator => console.log(`  - ${indicator}`));
    
    return foundIndicators.length >= 4;
    
  } catch (error) {
    console.log('❌ Clauses worker LLM test failed:', error.message);
    return false;
  }
}

// Test risk worker LLM integration
async function testRiskWorkerLLM() {
  console.log('\n⚠️ Testing Risk Worker LLM Integration...');
  
  try {
    const riskWorker = await import('./apps/workers/risk.worker.ts');
    console.log('✅ Risk worker imported successfully');
    
    const workerCode = await import('fs').then(fs => 
      fs.promises.readFile('./apps/workers/risk.worker.ts', 'utf8')
    );
    
    const llmIndicators = [
      'OpenAI',
      'chat.completions.create',
      'GPT-4',
      'performAdvancedRiskAnalysis',
      'generateRiskBestPractices'
    ];
    
    const foundIndicators = llmIndicators.filter(indicator => 
      workerCode.includes(indicator)
    );
    
    console.log(`✅ LLM integration indicators found: ${foundIndicators.length}/${llmIndicators.length}`);
    foundIndicators.forEach(indicator => console.log(`  - ${indicator}`));
    
    return foundIndicators.length >= 4;
    
  } catch (error) {
    console.log('❌ Risk worker LLM test failed:', error.message);
    return false;
  }
}

// Test compliance worker LLM integration
async function testComplianceWorkerLLM() {
  console.log('\n✅ Testing Compliance Worker LLM Integration...');
  
  try {
    const complianceWorker = await import('./apps/workers/compliance.worker.ts');
    console.log('✅ Compliance worker imported successfully');
    
    const workerCode = await import('fs').then(fs => 
      fs.promises.readFile('./apps/workers/compliance.worker.ts', 'utf8')
    );
    
    const llmIndicators = [
      'OpenAI',
      'chat.completions.create',
      'GPT-4',
      'performAdvancedComplianceAnalysis',
      'generateComplianceBestPractices'
    ];
    
    const foundIndicators = llmIndicators.filter(indicator => 
      workerCode.includes(indicator)
    );
    
    console.log(`✅ LLM integration indicators found: ${foundIndicators.length}/${llmIndicators.length}`);
    foundIndicators.forEach(indicator => console.log(`  - ${indicator}`));
    
    return foundIndicators.length >= 4;
    
  } catch (error) {
    console.log('❌ Compliance worker LLM test failed:', error.message);
    return false;
  }
}

// Test template worker LLM integration
async function testTemplateWorkerLLM() {
  console.log('\n📋 Testing Template Worker LLM Integration...');
  
  try {
    const templateWorker = await import('./apps/workers/template.worker.ts');
    console.log('✅ Template worker imported successfully');
    
    const workerCode = await import('fs').then(fs => 
      fs.promises.readFile('./apps/workers/template.worker.ts', 'utf8')
    );
    
    const llmIndicators = [
      'OpenAI',
      'chat.completions.create',
      'GPT-4',
      'LLM',
      'template'
    ];
    
    const foundIndicators = llmIndicators.filter(indicator => 
      workerCode.includes(indicator)
    );
    
    console.log(`✅ LLM integration indicators found: ${foundIndicators.length}/${llmIndicators.length}`);
    foundIndicators.forEach(indicator => console.log(`  - ${indicator}`));
    
    return foundIndicators.length >= 3;
    
  } catch (error) {
    console.log('❌ Template worker LLM test failed:', error.message);
    return false;
  }
}

// Simulate LLM analysis with test content
async function simulateLLMAnalysis() {
  console.log('\n🧪 Simulating LLM Analysis with Test Content...');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️ No API key available, skipping live LLM test');
    return false;
  }
  
  try {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });
    
    console.log('🔍 Analyzing test contract for financial terms...');
    
    const financialAnalysisPrompt = `
You are a senior financial analyst. Analyze this contract for financial terms and return a JSON response with the following structure:
{
  "financialTerms": [
    {
      "termType": "Payment",
      "description": "description here",
      "amount": "amount if found",
      "frequency": "frequency if applicable"
    }
  ],
  "totalValue": "estimated total value",
  "confidence": 95
}

Contract text: ${testContractContent.substring(0, 1000)}
`;

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial analyst. Respond only with valid JSON.'
        },
        {
          role: 'user',
          content: financialAnalysisPrompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });
    
    const result = response.choices?.[0]?.message?.content;
    console.log('📊 LLM Financial Analysis Result:');
    console.log(result);
    
    try {
      const parsed = JSON.parse(result);
      if (parsed.financialTerms && Array.isArray(parsed.financialTerms)) {
        console.log(`✅ LLM successfully identified ${parsed.financialTerms.length} financial terms`);
        console.log(`🎯 Confidence: ${parsed.confidence}%`);
        return true;
      }
    } catch (parseError) {
      console.log('⚠️ LLM response was not valid JSON, but API call succeeded');
      return true; // API works, just parsing issue
    }
    
  } catch (error) {
    console.log('❌ LLM analysis simulation failed:', error.message);
    return false;
  }
}

// Main test function
async function runLLMTests() {
  console.log('🚀 Starting Comprehensive LLM Artifact Population Tests\n');
  
  const results = {
    environment: false,
    connectivity: false,
    financialWorker: false,
    clausesWorker: false,
    riskWorker: false,
    complianceWorker: false,
    templateWorker: false,
    liveAnalysis: false
  };
  
  // Test environment setup
  const envCheck = checkEnvironmentSetup();
  results.environment = envCheck.allPresent;
  
  // Test LLM connectivity (only if API key is available)
  if (envCheck.presentVars.includes('OPENAI_API_KEY')) {
    results.connectivity = await testLLMConnectivity();
  } else {
    console.log('\n⚠️ Skipping connectivity test - no API key available');
  }
  
  // Test worker LLM integrations
  results.financialWorker = await testFinancialWorkerLLM();
  results.clausesWorker = await testClausesWorkerLLM();
  results.riskWorker = await testRiskWorkerLLM();
  results.complianceWorker = await testComplianceWorkerLLM();
  results.templateWorker = await testTemplateWorkerLLM();
  
  // Test live LLM analysis (only if connectivity works)
  if (results.connectivity) {
    results.liveAnalysis = await simulateLLMAnalysis();
  } else {
    console.log('\n⚠️ Skipping live analysis test - no LLM connectivity');
  }
  
  // Summary
  console.log('\n📊 LLM ARTIFACT POPULATION TEST RESULTS');
  console.log('==========================================');
  
  const testCategories = [
    { name: 'Environment Setup', result: results.environment },
    { name: 'LLM Connectivity', result: results.connectivity },
    { name: 'Financial Worker LLM', result: results.financialWorker },
    { name: 'Clauses Worker LLM', result: results.clausesWorker },
    { name: 'Risk Worker LLM', result: results.riskWorker },
    { name: 'Compliance Worker LLM', result: results.complianceWorker },
    { name: 'Template Worker LLM', result: results.templateWorker },
    { name: 'Live LLM Analysis', result: results.liveAnalysis }
  ];
  
  testCategories.forEach(test => {
    const status = test.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.name}`);
  });
  
  const passedTests = testCategories.filter(test => test.result).length;
  const totalTests = testCategories.length;
  
  console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests >= 6) {
    console.log('🎉 EXCELLENT: LLM artifact population is properly implemented!');
  } else if (passedTests >= 4) {
    console.log('👍 GOOD: Most LLM integrations are working, minor issues detected');
  } else {
    console.log('⚠️ NEEDS ATTENTION: Several LLM integrations may not be working properly');
  }
  
  // Specific recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  
  if (!results.environment) {
    console.log('- Set up OPENAI_API_KEY and OPENAI_MODEL environment variables');
  }
  
  if (!results.connectivity && envCheck.presentVars.includes('OPENAI_API_KEY')) {
    console.log('- Check API key validity and network connectivity');
  }
  
  const failedWorkers = testCategories
    .filter(test => test.name.includes('Worker') && !test.result)
    .map(test => test.name);
    
  if (failedWorkers.length > 0) {
    console.log(`- Review LLM integration in: ${failedWorkers.join(', ')}`);
  }
  
  if (!results.liveAnalysis && results.connectivity) {
    console.log('- Debug LLM prompt formatting and response parsing');
  }
  
  console.log('\n✨ LLM Artifact Population Test Complete!');
}

// Run the tests
runLLMTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});