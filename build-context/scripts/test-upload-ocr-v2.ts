#!/usr/bin/env npx tsx
/**
 * Deep Test: Upload + OCR + Artifacts Generation Flow v2
 * Tests the complete pipeline with correct endpoints
 */

import fs from 'fs';
import path from 'path';

const WEB_URL = 'http://localhost:3005';
const TENANT_ID = 'test-deep-upload-v2';

const TEST_CONTRACTS = {
  simple: `MASTER SERVICES AGREEMENT

Effective Date: January 1, 2025
Parties: Acme Corp ("Client") and TechVenture Inc ("Vendor")

ARTICLE 1 - SERVICES
The Vendor agrees to provide software development services.

ARTICLE 2 - PRICING
Hourly Rate: $150.00/hour
Monthly Retainer: $10,000

ARTICLE 3 - TERM
Initial Term: 12 months
Total Contract Value: $130,000

Signed: John Smith, CEO`,

  complex: `STATEMENT OF WORK #2024-001

BETWEEN: Global Enterprise Solutions ("Client")
AND: Advanced Technology Partners ("Vendor")

EFFECTIVE DATE: February 15, 2025

1. SCOPE OF WORK
- Software development services
- Cloud infrastructure setup

2. RATE CARD
| Role | Hourly Rate |
|------|-------------|
| Principal Architect | $275.00 |
| Senior Developer | $195.00 |
| Junior Developer | $95.00 |

3. MILESTONES
Phase 1: Discovery - $45,000 - March 2025
Phase 2: Development - $125,000 - May 2025
Phase 3: Testing - $55,000 - July 2025

4. FINANCIAL SUMMARY
Total Contract Value: $260,000 USD
Payment Terms: Net 30

5. COMPLIANCE
- SOC 2 Type II required
- ISO 27001 mandatory

6. RISKS
- Resource availability constraints
- Third-party integration delays

SIGNATURES:
Client: Robert Wilson, CTO - Feb 2025
Vendor: Sarah Johnson, MD - Feb 2025`
};

interface ContractStatus {
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

interface Artifact {
  id: string;
  type: string;
  contractId: string;
  data: Record<string, any>;
  validationStatus: string;
}

async function createMultipartFormData(
  content: string,
  fileName: string
): Promise<{ buffer: Buffer; boundary: string }> {
  const boundary = `----WebKitFormBoundary${Date.now()}`;
  const parts: Buffer[] = [];
  
  // File field
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
  parts.push(Buffer.from(`Content-Type: text/plain\r\n\r\n`));
  parts.push(Buffer.from(content));
  parts.push(Buffer.from(`\r\n`));
  
  // End boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  
  return { buffer: Buffer.concat(parts), boundary };
}

async function uploadContract(name: string, content: string): Promise<string | null> {
  console.log(`\n📤 Uploading: ${name}`);
  
  try {
    const fileName = `${name}-${Date.now()}.txt`;
    const { buffer, boundary } = await createMultipartFormData(content, fileName);
    
    const response = await fetch(`${WEB_URL}/api/contracts/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'x-tenant-id': TENANT_ID,
        'x-skip-duplicate-check': 'true',
      },
      body: buffer,
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`  ❌ Upload failed: ${response.status}`);
      console.error(`     ${text.substring(0, 200)}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`  ✅ Uploaded: ${data.contractId}`);
    console.log(`     Status: ${data.status}`);
    
    return data.contractId;
  } catch (error) {
    console.error(`  ❌ Error:`, error);
    return null;
  }
}

async function pollStatus(contractId: string, maxWait = 120): Promise<ContractStatus | null> {
  console.log(`\n⏳ Processing: ${contractId}`);
  
  const start = Date.now();
  let lastProgress = -1;
  
  while (Date.now() - start < maxWait * 1000) {
    try {
      const res = await fetch(`${WEB_URL}/api/contracts/${contractId}/status`, {
        headers: { 'x-tenant-id': TENANT_ID },
      });
      
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const status: ContractStatus = await res.json();
      
      if (status.progress !== lastProgress) {
        console.log(`  📊 ${status.progress}% | ${status.currentStep} | ${status.status}`);
        lastProgress = status.progress;
      }
      
      if (status.status === 'COMPLETED' || status.status === 'completed') {
        console.log(`  ✅ Complete! Artifacts: ${status.artifactsGenerated}/${status.totalArtifacts}`);
        return status;
      }
      
      if (status.status === 'FAILED' || status.status === 'failed') {
        console.error(`  ❌ Failed!`);
        return status;
      }
      
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.error(`  ⏰ Timeout`);
  return null;
}

async function getArtifacts(contractId: string): Promise<Artifact[]> {
  console.log(`\n📦 Fetching artifacts...`);
  
  try {
    const res = await fetch(`${WEB_URL}/api/contracts/${contractId}/artifacts`, {
      headers: { 'x-tenant-id': TENANT_ID },
    });
    
    if (!res.ok) {
      console.error(`  ❌ Failed: ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    const artifacts = Array.isArray(data) ? data : (data.artifacts || []);
    console.log(`  ✅ Found ${artifacts.length} artifacts`);
    
    return artifacts;
  } catch (error) {
    console.error(`  ❌ Error:`, error);
    return [];
  }
}

function analyzeQuality(artifacts: Artifact[]): void {
  console.log('\n📊 Quality Analysis');
  console.log('═'.repeat(50));
  
  for (const art of artifacts) {
    const data = art.data || {};
    console.log(`\n${art.type}:`);
    
    if (data._extractionMeta) {
      const conf = data._extractionMeta.contractTypeConfidence;
      console.log(`  Confidence: ${conf ? (conf * 100).toFixed(1) + '%' : 'N/A'}`);
      console.log(`  Type: ${data._extractionMeta.contractType || 'Unknown'}`);
      console.log(`  Review: ${data._extractionMeta.needsHumanReview ? 'Yes' : 'No'}`);
    }
    
    if (data.error) {
      console.log(`  ❌ Error: ${data.error}`);
      continue;
    }
    
    switch (art.type) {
      case 'OVERVIEW':
        console.log(`  Summary: ${(data.summary || '').substring(0, 60)}...`);
        console.log(`  Parties: ${data.parties?.length || 0}`);
        console.log(`  Value: ${data.totalValue || 'N/A'}`);
        break;
      case 'FINANCIAL':
        console.log(`  Value: ${data.totalValue || data.totalContractValue || 'N/A'}`);
        console.log(`  Terms: ${data.paymentTerms || 'N/A'}`);
        console.log(`  Rates: ${data.rateCards?.length || 0}`);
        console.log(`  Milestones: ${data.milestones?.length || 0}`);
        break;
      case 'RISK':
        console.log(`  Risks: ${data.riskFactors?.length || data.risks?.length || 0}`);
        console.log(`  Level: ${data.overallRiskLevel || 'N/A'}`);
        break;
      case 'COMPLIANCE':
        console.log(`  Requirements: ${data.requirements?.length || 0}`);
        console.log(`  Certifications: ${data.certifications?.length || 0}`);
        break;
      case 'CLAUSES':
        console.log(`  Clauses: ${data.clauses?.length || 0}`);
        break;
    }
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Upload + OCR + Artifacts Test v2                    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  
  // Check server
  console.log('\n🔍 Checking server...');
  try {
    const res = await fetch(WEB_URL);
    console.log(`  Server: ${res.ok ? '✅ OK' : '❌ ' + res.status}`);
  } catch {
    console.error('  ❌ Server not available');
    process.exit(1);
  }
  
  // Test 1: Simple contract
  console.log('\n' + '═'.repeat(50));
  console.log('TEST 1: Simple Contract');
  console.log('═'.repeat(50));
  
  const id1 = await uploadContract('simple-msa', TEST_CONTRACTS.simple);
  if (id1) {
    const status1 = await pollStatus(id1);
    if (status1?.status?.toUpperCase() === 'COMPLETED') {
      const arts1 = await getArtifacts(id1);
      analyzeQuality(arts1);
    }
  }
  
  // Test 2: Complex contract
  console.log('\n' + '═'.repeat(50));
  console.log('TEST 2: Complex Contract with Rate Tables');
  console.log('═'.repeat(50));
  
  const id2 = await uploadContract('complex-sow', TEST_CONTRACTS.complex);
  if (id2) {
    const status2 = await pollStatus(id2);
    if (status2?.status?.toUpperCase() === 'COMPLETED') {
      const arts2 = await getArtifacts(id2);
      analyzeQuality(arts2);
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('Summary');
  console.log('═'.repeat(50));
  console.log(`Contract 1: ${id1 ? '✅' : '❌'}`);
  console.log(`Contract 2: ${id2 ? '✅' : '❌'}`);
}

main().catch(console.error);
