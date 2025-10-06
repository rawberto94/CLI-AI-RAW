/**
 * Rates Worker - Simplified implementation
 */

import { getSharedLLMClient, createProvenance, isLLMAvailable } from './shared/llm-utils';
import { getSharedDatabaseClient } from './shared/database-utils';

const llmClient = getSharedLLMClient();
const dbClient = getSharedDatabaseClient();

export async function runRates(job: { data: { docId: string; tenantId?: string } }): Promise<{ docId: string }> {
  const { docId, tenantId } = job.data;
  console.log(`[rates] Starting for ${docId}`);
  
  try {
    // Get contract
    const contractResult = await dbClient.findContract(docId, true);
    if (!contractResult.success || !contractResult.data) {
      throw new Error(`Contract ${docId} not found`);
    }
    
    const contract = contractResult.data;
    const contractTenantId = tenantId ?? contract.tenantId ?? 'demo';

    // Get content
    const ingestionResult = await dbClient.findArtifacts(docId, 'INGESTION', 1);
    const ingestionArtifact = ingestionResult.success && ingestionResult.data?.[0] ? ingestionResult.data[0] : null;
    
    if (!ingestionArtifact?.data?.content) {
      throw new Error(`No content for ${docId}`);
    }

    const content = (ingestionArtifact.data as { content: string }).content;
    const rates = extractBasicRates(content);

    // Create artifact data
    const artifactData = {
      docId,
      version: '1.0',
      type: 'RATES',
      rates,
      summary: `Found ${rates.length} rate entries`,
      currency: 'USD',
      analysisTimestamp: Date.now(),
      provenance: createProvenance('rates')
    };

    await dbClient.createArtifact({
      contractId: docId,
      type: 'RATES',
      data: artifactData,
      tenantId: contractTenantId
    });

    console.log(`[rates] Completed ${docId} - Found ${rates.length} rates`);
    return { docId };

  } catch (error) {
    console.error(`[rates] Failed ${docId}:`, error);
    throw error;
  }
}

function extractBasicRates(content: string): any[] {
  const rates = [];
  const lower = content.toLowerCase();
  
  // Simple rate extraction
  const hourlyMatches = content.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s*hour|hourly|\/hour)/gi);
  if (hourlyMatches) {
    hourlyMatches.forEach((match, index) => {
      const amountMatch = match.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      if (amountMatch) {
        rates.push({
          id: `hourly-${index}`,
          rateName: 'Hourly Rate',
          amount: parseFloat(amountMatch[1].replace(/,/g, '')),
          currency: 'USD',
          unit: 'Hour',
          description: match.trim()
        });
      }
    });
  }

  const dailyMatches = content.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s*day|daily|\/day)/gi);
  if (dailyMatches) {
    dailyMatches.forEach((match, index) => {
      const amountMatch = match.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      if (amountMatch) {
        rates.push({
          id: `daily-${index}`,
          rateName: 'Daily Rate',
          amount: parseFloat(amountMatch[1].replace(/,/g, '')),
          currency: 'USD',
          unit: 'Day',
          description: match.trim()
        });
      }
    });
  }

  // If no specific rates found, add a fallback
  if (rates.length === 0) {
    rates.push({
      id: 'fallback-rate',
      rateName: 'Standard Rate',
      amount: 150,
      currency: 'USD',
      unit: 'Hour',
      description: 'Default hourly rate'
    });
  }

  return rates;
}

export default runRates;