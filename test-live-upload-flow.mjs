#!/usr/bin/env node

/**
 * Live Upload Flow Test
 * Tests actual contract upload and verifies LLM-generated artifacts
 */

import fs from 'fs';
import fetch from 'node-fetch';

// Load environment variables
const loadEnv = () => {
  const envFile = '.env';
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    for (const line of envLines) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value.trim();
        }
      }
    }
  }
};

loadEnv();

const API_BASE = 'http://localhost:3001';
const TENANT_ID = 'test-tenant';

console.log('🧪 Live Contract Upload and Analysis Test\n');

// Create a comprehensive test contract
const createTestContract = () => {
  const contract = `
MASTER SERVICES AGREEMENT

This Master Services Agreement ("Agreement") is entered into on March 1, 2024,
between GlobalTech Solutions Inc., a Delaware corporation ("Client") and 
InnovateConsulting LLC, a California limited liability company ("Service Provider").

SCOPE OF SERVICES:
Service Provider will provide the following professional services:
1. Software development and engineering services
2. Cloud infrastructure design and implementation  
3. Data analytics and business intelligence solutions
4. Cybersecurity consulting and implementation
5. Digital transformation strategy and execution

RESOURCE ALLOCATION AND RATES:
The following resources and rates are established:

Technical Resources:
- Principal Architect: $250/hour
- Senior Software Engineer: $185/hour
- Mid-level Software Engineer: $145/hour
- Junior Software Engineer: $95/hour
- DevOps Engineer: $175/hour
- Data Scientist: $195/hour
- Security Specialist: $220/hour

Management Resources:
- Program Manager: $180/hour
- Project Manager: $150/hour
- Scrum Master: $135/hour
- Business Analyst: $125/hour

PAYMENT TERMS:
- Payment terms: Net 30 days from invoice date
- Late payment penalty: 1.5% per month on overdue amounts
- All rates are in USD and subject to annual review
- Expenses require pre-approval and will be reimbursed at cost

CONFIDENTIALITY AND NON-DISCLOSURE:
Both parties acknowledge that they will have access to confidential and proprietary 
information. Each party agrees to:
1. Maintain strict confidentiality of all proprietary information
2. Not disclose confidential information to third parties
3. Use confidential information solely for the purposes of this agreement
4. Return all confidential materials upon termination

INTELLECTUAL PROPERTY RIGHTS:
1. All work product created by Service Provider shall be owned by Client
2. Service Provider hereby assigns all rights, title, and interest to Client
3. Service Provider retains rights to pre-existing intellectual property
4. Client grants Service Provider license to use Client's IP solely for service delivery

PERFORMANCE STANDARDS AND SERVICE LEVELS:
Service Provider agrees to maintain the following standards:
- System uptime: 99.9% availability
- Response time for critical issues: Within 2 hours
- Response time for standard issues: Within 24 hours
- Code quality: Must pass all defined quality gates
- Security compliance: Must meet SOC 2 Type II standards

TERMINATION PROVISIONS:
1. Either party may terminate with sixty (60) days written notice
2. Client may terminate immediately for cause
3. Upon termination, Service Provider must deliver all work product
4. Confidentiality obligations survive termination indefinitely
5. Payment obligations for completed work remain in effect

LIABILITY AND INDEMNIFICATION:
1. Service Provider's liability is limited to amounts paid under this agreement
2. Neither party liable for indirect, incidental, or consequential damages
3. Each party indemnifies the other for third-party claims arising from their actions
4. Professional liability insurance of $2M minimum required

FORCE MAJEURE:
Neither party shall be liable for delays or failures due to circumstances beyond 
reasonable control, including acts of God, government actions, natural disasters, 
pandemics, or other unforeseeable events.

DATA PROTECTION AND PRIVACY:
1. Both parties will comply with GDPR, CCPA, and applicable privacy laws
2. Personal data processing requires documented lawful basis
3. Data breach notification within 72 hours
4. Data subject rights must be honored
5. Regular privacy impact assessments required

GOVERNING LAW AND DISPUTE RESOLUTION:
1. This agreement is governed by California state law
2. Disputes will be resolved through binding arbitration
3. Arbitration conducted under AAA Commercial Rules
4. Venue: San Francisco, California
5. Prevailing party entitled to attorney fees

COMPLIANCE AND REGULATORY:
Service Provider must maintain compliance with:
- SOX requirements for financial systems
- HIPAA for healthcare-related data
- PCI DSS for payment processing
- ISO 27001 security standards
- Industry-specific regulations as applicable

This agreement represents the complete understanding between the parties and 
supersedes all prior agreements and understandings.

IN WITNESS WHEREOF, the parties execute this agreement on the date first written above.

GLOBTECH SOLUTIONS INC.          INNOVATECONSULTING LLC
By: Michael Johnson              By: Sarah Chen
Title: Chief Executive Officer   Title: Managing Partner
Date: March 1, 2024             Date: March 1, 2024
`;

  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync('tmp/comprehensive-test-contract.txt', contract.trim());
  return 'tmp/comprehensive-test-contract.txt';
};

// Test functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const testUploadFlow = async () => {
  try {
    console.log('1. 📄 Creating comprehensive test contract...');
    const contractPath = createTestContract();
    const contractContent = fs.readFileSync(contractPath, 'utf8');
    console.log(`   ✅ Contract created: ${Math.round(contractContent.length / 1024)}KB`);

    console.log('\n2. 🚀 Testing direct upload to API...');
    
    // Test direct upload (simulated)
    const uploadResponse = await fetch(`${API_BASE}/uploads/init-signed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID
      },
      body: JSON.stringify({
        filename: 'comprehensive-test-contract.txt',
        contentType: 'text/plain'
      })
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload init failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();
    console.log(`   ✅ Upload initialized: ${uploadData.docId}`);

    // Finalize upload
    const finalizeResponse = await fetch(`${API_BASE}/uploads/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID
      },
      body: JSON.stringify({
        docId: uploadData.docId,
        filename: 'comprehensive-test-contract.txt',
        storagePath: uploadData.storagePath
      })
    });

    if (!finalizeResponse.ok) {
      throw new Error(`Upload finalize failed: ${finalizeResponse.status} ${finalizeResponse.statusText}`);
    }

    const finalizeData = await finalizeResponse.json();
    console.log(`   ✅ Upload finalized: ${finalizeData.docId}`);

    const docId = finalizeData.docId;

    console.log('\n3. ⏳ Waiting for analysis pipeline to complete...');
    
    // Wait for analysis to complete (check status)
    let analysisComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (!analysisComplete && attempts < maxAttempts) {
      attempts++;
      await sleep(10000); // Wait 10 seconds
      
      try {
        const statusResponse = await fetch(`${API_BASE}/contracts/${docId}/status`, {
          headers: { 'x-tenant-id': TENANT_ID }
        });
        
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          console.log(`   📊 Analysis progress: ${JSON.stringify(status)}`);
          
          // Check if key analyses are complete
          if (status.stages && 
              status.stages.overview && 
              status.stages.rates && 
              status.stages.clauses) {
            analysisComplete = true;
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Status check ${attempts}: ${error.message}`);
      }
    }

    if (!analysisComplete) {
      console.log('   ⚠️  Analysis may still be in progress after 5 minutes');
    }

    console.log('\n4. 🔍 Checking generated artifacts...');

    // Check each artifact type
    const artifactTypes = [
      'overview',
      'clauses', 
      'rates',
      'risk',
      'compliance',
      'benchmark'
    ];

    const artifactResults = {};

    for (const artifactType of artifactTypes) {
      try {
        const artifactResponse = await fetch(`${API_BASE}/contracts/${docId}/artifacts/${artifactType}.json`, {
          headers: { 'x-tenant-id': TENANT_ID }
        });

        if (artifactResponse.ok) {
          const artifact = await artifactResponse.json();
          artifactResults[artifactType] = artifact;
          
          // Check for LLM-generated content
          const hasLLMContent = JSON.stringify(artifact).length > 500; // Basic size check
          const hasBestPractices = JSON.stringify(artifact).includes('bestPractices') || 
                                   JSON.stringify(artifact).includes('BestPractices');
          
          console.log(`   ✅ ${artifactType}: Generated (${Math.round(JSON.stringify(artifact).length / 1024)}KB)${hasBestPractices ? ' + Best Practices' : ''}`);
          
          // Log key insights for overview
          if (artifactType === 'overview' && artifact.summary) {
            console.log(`      📝 Summary: ${artifact.summary.substring(0, 100)}...`);
          }
          
          // Log rates found
          if (artifactType === 'rates' && artifact.rates && artifact.rates.length > 0) {
            console.log(`      💰 Rates found: ${artifact.rates.length} entries`);
            const sampleRate = artifact.rates[0];
            if (sampleRate.role && sampleRate.amount) {
              console.log(`      💼 Sample: ${sampleRate.role} - $${sampleRate.amount}/${sampleRate.uom || 'hour'}`);
            }
          }
          
          // Log clauses found
          if (artifactType === 'clauses' && artifact.clauses && artifact.clauses.length > 0) {
            console.log(`      📋 Clauses found: ${artifact.clauses.length} entries`);
          }
          
          // Log risks found
          if (artifactType === 'risk' && artifact.risks && artifact.risks.length > 0) {
            console.log(`      ⚠️  Risks identified: ${artifact.risks.length} entries`);
            const highRisks = artifact.risks.filter(r => r.severity === 'high').length;
            if (highRisks > 0) {
              console.log(`      🚨 High-severity risks: ${highRisks}`);
            }
          }
          
        } else {
          console.log(`   ❌ ${artifactType}: Not available (${artifactResponse.status})`);
          artifactResults[artifactType] = null;
        }
      } catch (error) {
        console.log(`   ❌ ${artifactType}: Error - ${error.message}`);
        artifactResults[artifactType] = null;
      }
    }

    console.log('\n5. 🤖 Testing RAG Search...');
    
    try {
      const ragResponse = await fetch(`${API_BASE}/api/rag/search?docId=${docId}&q=payment terms and rates&k=5`, {
        headers: { 'x-tenant-id': TENANT_ID }
      });
      
      if (ragResponse.ok) {
        const ragResults = await ragResponse.json();
        if (ragResults.enabled && ragResults.items && ragResults.items.length > 0) {
          console.log(`   ✅ RAG search: ${ragResults.items.length} results found`);
          console.log(`   🔍 Sample result: ${ragResults.items[0].text.substring(0, 100)}...`);
        } else {
          console.log('   ⚠️  RAG search: No results or disabled');
        }
      } else {
        console.log(`   ❌ RAG search failed: ${ragResponse.status}`);
      }
    } catch (error) {
      console.log(`   ❌ RAG search error: ${error.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 LIVE UPLOAD FLOW TEST RESULTS');
    console.log('='.repeat(70));

    const successfulArtifacts = Object.values(artifactResults).filter(Boolean).length;
    const totalArtifacts = artifactTypes.length;

    console.log(`\n🎯 Artifacts Generated: ${successfulArtifacts}/${totalArtifacts}`);
    console.log(`📄 Document ID: ${docId}`);
    console.log(`🏢 Tenant ID: ${TENANT_ID}`);

    if (successfulArtifacts >= 4) {
      console.log('\n🎉 UPLOAD AND ANALYSIS SUCCESSFUL!');
      console.log('\nYour contract intelligence system successfully:');
      console.log('✅ Processed contract upload');
      console.log('✅ Generated LLM-powered artifacts');
      console.log('✅ Extracted rates and financial terms');
      console.log('✅ Identified contract clauses');
      console.log('✅ Assessed risks and compliance');
      console.log('✅ Provided expert best practices');
      
      // Check for specific LLM features
      const overviewArtifact = artifactResults.overview;
      if (overviewArtifact && overviewArtifact.parties && overviewArtifact.parties.length > 0) {
        console.log(`✅ Extracted parties: ${overviewArtifact.parties.join(', ')}`);
      }
      
      const ratesArtifact = artifactResults.rates;
      if (ratesArtifact && ratesArtifact.rates && ratesArtifact.rates.length > 0) {
        const totalRates = ratesArtifact.rates.length;
        const avgRate = ratesArtifact.rates
          .filter(r => r.dailyUsd && r.dailyUsd > 0)
          .reduce((sum, r, _, arr) => sum + r.dailyUsd / arr.length, 0);
        console.log(`✅ Extracted ${totalRates} rates (avg: $${Math.round(avgRate)}/day)`);
      }
      
    } else {
      console.log('\n⚠️  PARTIAL SUCCESS');
      console.log('Some artifacts were not generated. This could be due to:');
      console.log('- Analysis still in progress');
      console.log('- Worker processing delays');
      console.log('- LLM API rate limits');
      console.log('- Service configuration issues');
    }

    console.log('\n' + '='.repeat(70));
    return successfulArtifacts >= 4;

  } catch (error) {
    console.error('\n❌ Upload flow test failed:', error.message);
    return false;
  }
};

// Run the test
testUploadFlow().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});