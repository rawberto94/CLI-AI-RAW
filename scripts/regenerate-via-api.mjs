#!/usr/bin/env node
/**
 * Trigger LLM artifact regeneration via API
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), 'apps/web/.env') });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

async function regenerateArtifacts(contractId) {
  console.log(`\n🔄 Regenerating artifacts for: ${contractId}`);
  
  try {
    const response = await fetch(
      `${API_URL}/api/contracts/${contractId}/artifacts/regenerate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Success: ${data.message || 'Artifacts regenerated'}`);
      if (data.artifacts) {
        console.log(`   Generated ${data.artifacts.length} artifacts:`);
        data.artifacts.forEach(a => console.log(`   - ${a.type}`));
      }
      return true;
    } else {
      console.log(`❌ Failed: ${data.message || data.error}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 LLM Artifact Regeneration via API');
  console.log('=====================================\n');
  
  const contractId = process.argv[2];
  
  if (contractId) {
    await regenerateArtifacts(contractId);
  } else {
    // Get list of contracts
    const response = await fetch(`${API_URL}/api/contracts/list?limit=5`);
    const { data } = await response.json();
    
    console.log(`Found ${data?.contracts?.length || 0} contracts\n`);
    
    let success = 0;
    let failed = 0;
    
    for (const contract of data?.contracts || []) {
      const result = await regenerateArtifacts(contract.id);
      if (result) success++;
      else failed++;
      
      // Delay to avoid overwhelming the API
      await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log(`\n📊 Summary: ✅ ${success} success, ❌ ${failed} failed`);
  }
}

main().catch(console.error);
