#!/usr/bin/env npx tsx
/**
 * Deep Test: Upload + OCR + Artifacts Generation Flow
 * Tests the complete pipeline and OCR accuracy features
 */

import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3001';
const WEB_URL = 'http://localhost:3005';
const TENANT_ID = 'test-deep-upload-flow';

// Test file contents - realistic contract data
const TEST_CONTRACTS = {
  simple: `
MASTER SERVICES AGREEMENT

Effective Date: January 1, 2025
Parties: Acme Corp ("Client") and TechVenture Inc ("Vendor")

ARTICLE 1 - SERVICES
The Vendor agrees to provide software development services.

ARTICLE 2 - PRICING
Hourly Rate: $150.00/hour
Monthly Retainer: $10,000

ARTICLE 3 - TERM
Initial Term: 12 months
Auto-renewal: Yes, annually

Total Contract Value: $130,000

Signed:
Client: John Smith, CEO
Vendor: Jane Doe, President
`,
  
  complex: `
STATEMENT OF WORK #2024-001

PROFESSIONAL SERVICES AGREEMENT
BETWEEN: Global Enterprise Solutions ("Client")
AND: Advanced Technology Partners ("Vendor")

EFFECTIVE DATE: February 15, 2025
CONTRACT NUMBER: SOW-2024-001

1. SCOPE OF WORK
1.1 Software Development Services
- Full-stack web application development
- API design and implementation
- Database architecture and optimization
- Cloud infrastructure setup (AWS/Azure)

1.2 Project Management
- Agile methodology implementation
- Weekly sprint reviews
- Monthly executive reporting

2. RATE CARD

| Role                    | Hourly Rate | Daily Rate |
|------------------------|-------------|------------|
| Principal Architect    | $275.00     | $2,200.00  |
| Senior Developer       | $195.00     | $1,560.00  |
| Mid-Level Developer    | $145.00     | $1,160.00  |
| Junior Developer       | $95.00      | $760.00    |
| QA Engineer            | $125.00     | $1,000.00  |
| Project Manager        | $165.00     | $1,320.00  |
| Technical Writer       | $110.00     | $880.00    |

3. MILESTONES & DELIVERABLES

Phase 1: Discovery & Planning
- Due Date: March 15, 2025
- Payment: $45,000
- Deliverables: Architecture docs, project plan

Phase 2: Core Development
- Due Date: May 31, 2025
- Payment: $125,000
- Deliverables: MVP application, API endpoints

Phase 3: Testing & QA
- Due Date: July 15, 2025
- Payment: $55,000
- Deliverables: Test reports, bug fixes

Phase 4: Deployment & Training
- Due Date: August 31, 2025
- Payment: $35,000
- Deliverables: Production deployment, user training

4. FINANCIAL SUMMARY
Total Contract Value: $260,000 USD
Payment Terms: Net 30
Late Payment Penalty: 1.5% per month

5. COMPLIANCE REQUIREMENTS
- SOC 2 Type II certification required
- ISO 27001 compliance mandatory
- GDPR data handling procedures
- Annual security audits

6. RISK FACTORS
6.1 Schedule Risks
- Resource availability constraints
- Third-party integration delays
- Scope creep without change orders

6.2 Technical Risks
- Legacy system compatibility
- Performance optimization challenges
- Data migration complexity

7. CONFIDENTIALITY
All project materials are confidential.
NDA expires 3 years after contract termination.

8. TERMINATION
Either party may terminate with 60 days notice.
Client responsible for work completed upon termination.

SIGNATURES:

Client: Global Enterprise Solutions
By: Robert Wilson, Chief Technology Officer
Date: February 1, 2025

Vendor: Advanced Technology Partners
By: Sarah Johnson, Managing Director
Date: February 1, 2025
`
};

interface HealthResponse {
  status: string;
  version?: string;
}

interface UploadInitResponse {
  contractId: string;
  uploadUrl?: string;
  success?: boolean;
}

interface ContractStatusResponse {
  contractId: string;
  status: string;
  currentStep: string;
  progress: number;
  artifactsGenerated: number;
  totalArtifacts: number;
  hasOverview?: boolean;
  hasFinancial?: boolean;
  hasRisk?: boolean;
  hasCompliance?: boolean;
  hasClauses?: boolean;
}

interface ArtifactResponse {
  id: string;
  type: string;
  contractId: string;
  data: Record<string, any>;
  validationStatus: string;
}

async function checkServices(): Promise<boolean> {
  console.log('\n🔍 Checking services...');
  
  try {
    // Check API
    const apiRes = await fetch(`${API_URL}/healthz`);
    const apiData = await apiRes.json() as HealthResponse;
    console.log(`  ✅ API Server: ${apiData.status}`);
    
    // Check Web
    const webRes = await fetch(WEB_URL);
    console.log(`  ✅ Web Server: ${webRes.status === 200 ? 'OK' : webRes.status}`);
    
    return true;
  } catch (error) {
    console.error('  ❌ Service check failed:', error);
    return false;
  }
}

async function uploadContract(name: string, content: string): Promise<string | null> {
  console.log(`\n📤 Uploading contract: ${name}`);
  
  try {
    // Step 1: Initialize upload
    console.log('  Step 1: Initializing upload...');
    const initRes = await fetch(`${WEB_URL}/api/contracts/upload/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
      },
      body: JSON.stringify({
        fileName: `${name}.txt`,
        fileSize: Buffer.byteLength(content, 'utf-8'),
        mimeType: 'text/plain',
        tenantId: TENANT_ID,
      }),
    });
    
    if (!initRes.ok) {
      const errText = await initRes.text();
      console.error(`  ❌ Upload init failed: ${initRes.status} - ${errText}`);
      return null;
    }
    
    const initData = await initRes.json() as UploadInitResponse;
    const contractId = initData.contractId;
    console.log(`  ✅ Contract ID: ${contractId}`);
    
    // Step 2: Upload content via multipart
    console.log('  Step 2: Uploading file content...');
    const formData = new FormData();
    formData.append('file', Buffer.from(content), {
      filename: `${name}.txt`,
      contentType: 'text/plain',
    });
    formData.append('contractId', contractId);
    formData.append('tenantId', TENANT_ID);
    
    const uploadRes = await fetch(`${WEB_URL}/api/contracts/upload`, {
      method: 'POST',
      headers: {
        'x-tenant-id': TENANT_ID,
        ...formData.getHeaders(),
      },
      body: formData.getBuffer(),
    });
    
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error(`  ❌ File upload failed: ${uploadRes.status} - ${errText}`);
      return null;
    }
    
    const uploadData = await uploadRes.json();
    console.log(`  ✅ Upload response:`, JSON.stringify(uploadData, null, 2).substring(0, 200));
    
    return contractId;
  } catch (error) {
    console.error(`  ❌ Upload error:`, error);
    return null;
  }
}

async function pollContractStatus(contractId: string, maxWaitSeconds = 120): Promise<ContractStatusResponse | null> {
  console.log(`\n⏳ Polling status for contract: ${contractId}`);
  
  const startTime = Date.now();
  const pollInterval = 3000; // 3 seconds
  let lastProgress = 0;
  let attempts = 0;
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    attempts++;
    
    try {
      const res = await fetch(`${WEB_URL}/api/contracts/${contractId}/status`, {
        headers: { 'x-tenant-id': TENANT_ID },
      });
      
      if (!res.ok) {
        console.log(`  ⚠️ Status poll ${attempts} returned ${res.status}`);
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }
      
      const status = await res.json() as ContractStatusResponse;
      
      if (status.progress !== lastProgress) {
        console.log(`  📊 Progress: ${status.progress}% | Step: ${status.currentStep} | Status: ${status.status}`);
        lastProgress = status.progress;
      }
      
      if (status.status === 'COMPLETED' || status.status === 'completed') {
        console.log(`  ✅ Processing completed!`);
        console.log(`     - Artifacts generated: ${status.artifactsGenerated}/${status.totalArtifacts}`);
        console.log(`     - Overview: ${status.hasOverview ? '✓' : '✗'}`);
        console.log(`     - Financial: ${status.hasFinancial ? '✓' : '✗'}`);
        console.log(`     - Risk: ${status.hasRisk ? '✓' : '✗'}`);
        console.log(`     - Compliance: ${status.hasCompliance ? '✓' : '✗'}`);
        console.log(`     - Clauses: ${status.hasClauses ? '✓' : '✗'}`);
        return status;
      }
      
      if (status.status === 'FAILED' || status.status === 'failed') {
        console.error(`  ❌ Processing failed!`);
        return status;
      }
      
      await new Promise(r => setTimeout(r, pollInterval));
    } catch (error) {
      console.log(`  ⚠️ Poll ${attempts} error:`, error);
      await new Promise(r => setTimeout(r, pollInterval));
    }
  }
  
  console.error(`  ⏰ Timeout after ${maxWaitSeconds} seconds`);
  return null;
}

async function fetchArtifacts(contractId: string): Promise<ArtifactResponse[]> {
  console.log(`\n📦 Fetching artifacts for: ${contractId}`);
  
  try {
    const res = await fetch(`${WEB_URL}/api/contracts/${contractId}/artifacts`, {
      headers: { 'x-tenant-id': TENANT_ID },
    });
    
    if (!res.ok) {
      console.error(`  ❌ Failed to fetch artifacts: ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    const artifacts = Array.isArray(data) ? data : (data.artifacts || []);
    
    console.log(`  ✅ Found ${artifacts.length} artifacts`);
    
    for (const artifact of artifacts) {
      console.log(`  📄 ${artifact.type}:`);
      console.log(`     - ID: ${artifact.id}`);
      console.log(`     - Validation: ${artifact.validationStatus || 'N/A'}`);
      
      // Show key data points
      if (artifact.data) {
        const dataKeys = Object.keys(artifact.data).slice(0, 5);
        console.log(`     - Data keys: ${dataKeys.join(', ')}...`);
      }
    }
    
    return artifacts;
  } catch (error) {
    console.error(`  ❌ Fetch error:`, error);
    return [];
  }
}

async function analyzeArtifactQuality(artifacts: ArtifactResponse[]): Promise<void> {
  console.log('\n📊 Artifact Quality Analysis');
  console.log('=' .repeat(60));
  
  for (const artifact of artifacts) {
    console.log(`\n📄 ${artifact.type} Artifact:`);
    
    const data = artifact.data || {};
    
    // Check confidence scores
    if (data._extractionMeta) {
      const meta = data._extractionMeta;
      console.log(`  📈 Confidence: ${meta.contractTypeConfidence ? (meta.contractTypeConfidence * 100).toFixed(1) + '%' : 'N/A'}`);
      console.log(`  🏷️  Contract Type: ${meta.contractType || 'Unknown'}`);
      console.log(`  ⚠️  Needs Review: ${meta.needsHumanReview ? 'Yes' : 'No'}`);
    }
    
    // Check for errors
    if (data.error) {
      console.log(`  ❌ Error: ${data.error}`);
    }
    
    // Type-specific checks
    switch (artifact.type) {
      case 'OVERVIEW':
        console.log(`  📝 Summary: ${data.summary ? data.summary.substring(0, 100) + '...' : 'Missing'}`);
        console.log(`  👥 Parties: ${data.parties ? data.parties.length : 0}`);
        console.log(`  💰 Total Value: ${data.totalValue || 'Not extracted'}`);
        break;
        
      case 'FINANCIAL':
        console.log(`  💵 Total Value: ${data.totalValue || data.totalContractValue || 'Not extracted'}`);
        console.log(`  📅 Payment Terms: ${data.paymentTerms || 'Not extracted'}`);
        console.log(`  📊 Rate Cards: ${data.rateCards ? data.rateCards.length : 0}`);
        console.log(`  🎯 Milestones: ${data.milestones ? data.milestones.length : 0}`);
        break;
        
      case 'RISK':
        console.log(`  ⚠️  Risk Factors: ${data.riskFactors ? data.riskFactors.length : (data.risks ? data.risks.length : 0)}`);
        console.log(`  🔴 Overall Risk: ${data.overallRiskLevel || 'Not assessed'}`);
        break;
        
      case 'COMPLIANCE':
        console.log(`  ✅ Requirements: ${data.requirements ? data.requirements.length : 0}`);
        console.log(`  📋 Certifications: ${data.certifications ? data.certifications.length : 0}`);
        break;
        
      case 'CLAUSES':
        console.log(`  📜 Clauses Found: ${data.clauses ? data.clauses.length : 0}`);
        break;
    }
  }
}

async function runTest(): Promise<void> {
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  Deep Test: Upload + OCR + Artifacts Pipeline           ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  
  // Check services
  const servicesOk = await checkServices();
  if (!servicesOk) {
    console.error('\n❌ Services not available. Please start them first.');
    process.exit(1);
  }
  
  // Test 1: Simple contract
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Simple Contract Upload');
  console.log('='.repeat(60));
  
  const simpleContractId = await uploadContract('simple-msa', TEST_CONTRACTS.simple);
  if (simpleContractId) {
    const status1 = await pollContractStatus(simpleContractId);
    if (status1 && status1.status === 'COMPLETED') {
      const artifacts1 = await fetchArtifacts(simpleContractId);
      await analyzeArtifactQuality(artifacts1);
    }
  }
  
  // Test 2: Complex contract with rate tables
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Complex Contract with Rate Tables');
  console.log('='.repeat(60));
  
  const complexContractId = await uploadContract('complex-sow', TEST_CONTRACTS.complex);
  if (complexContractId) {
    const status2 = await pollContractStatus(complexContractId);
    if (status2 && status2.status === 'COMPLETED') {
      const artifacts2 = await fetchArtifacts(complexContractId);
      await analyzeArtifactQuality(artifacts2);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Summary');
  console.log('='.repeat(60));
  console.log(`Simple Contract: ${simpleContractId ? '✅ Created' : '❌ Failed'}`);
  console.log(`Complex Contract: ${complexContractId ? '✅ Created' : '❌ Failed'}`);
}

runTest().catch(console.error);
