/**
 * Populate Contract Fields from Artifacts API
 * POST /api/contracts/populate-from-artifacts
 * 
 * Backfills contract columns (type, parties, value, dates) from 
 * already-generated OVERVIEW artifacts.
 * 
 * This is useful for contracts that were processed before the 
 * auto-populate feature was added.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { contractService } from 'data-orchestration/services';
import { getTenantIdFromRequest } from "@/lib/tenant-server";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { queueBatchRAGReindex } from "@/lib/rag/reindex-helper";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PopulateResult {
  contractId: string;
  fieldsPopulated: string[];
  success: boolean;
  error?: string;
}

/**
 * Party data from OVERVIEW artifact
 */
interface PartyData {
  name?: string;
  role?: string;
}

export const POST = withAuthApiHandler(async (request, ctx) => {
  let tenantId: string;
  try {
    tenantId = await getTenantIdFromRequest(request);
  } catch {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }
  const body = await request.json().catch(() => ({}));
  
  // Options
  const contractIds = body.contractIds as string[] | undefined;
  const overwrite = body.overwrite === true; // Whether to overwrite existing values
  const dryRun = body.dryRun === true; // Preview without updating

  // Find contracts to process
  // Use Prisma.ContractWhereInput type for proper typing
  const whereClause: any = {
    tenantId,
    status: 'COMPLETED', // Only process completed contracts
  };
  
  if (contractIds && contractIds.length > 0) {
    whereClause.id = { in: contractIds };
  }
  
  // If not overwriting, only get contracts missing data
  if (!overwrite) {
    whereClause.OR = [
      { contractType: null },
      { contractType: '' },
      { contractType: 'UNKNOWN' },
      { supplierName: null },
      { clientName: null },
      { totalValue: null },
      { expirationDate: null },
    ];
  }
  
  const contracts = await prisma.contract.findMany({
    where: whereClause,
    select: {
      id: true,
      contractType: true,
      clientName: true,
      supplierName: true,
      totalValue: true,
      effectiveDate: true,
      expirationDate: true,
      contractTitle: true,
    },
    take: 100, // Process in batches
  });
  
  if (contracts.length === 0) {
    return createSuccessResponse(ctx, {
      message: "No contracts need population",
      processed: 0,
      results: [],
    });
  }
  
  // Get OVERVIEW artifacts for these contracts
  const artifacts = await prisma.artifact.findMany({
    where: {
      contractId: { in: contracts.map(c => c.id) },
      tenantId,
      type: 'OVERVIEW',
    },
    select: {
      contractId: true,
      data: true,
    },
  });
  
  const artifactMap = new Map(artifacts.map(a => [a.contractId, a.data]));
  
  const results: PopulateResult[] = [];
  let totalUpdated = 0;
  
  // Helper to unwrap values (AI may return { value: X, source: '...' } or just X)
  const unwrap = (val: any) => val?.value !== undefined ? val.value : val;
  const unwrapNumber = (val: any): number | null => {
    const unwrapped = unwrap(val);
    if (typeof unwrapped === 'number') return unwrapped;
    if (typeof unwrapped === 'string') {
      const cleaned = unwrapped.replace(/[$€£¥,]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };
  
  for (const contract of contracts) {
    const overviewData = artifactMap.get(contract.id) as any;
    
    if (!overviewData || overviewData.error) {
      results.push({
        contractId: contract.id,
        fieldsPopulated: [],
        success: false,
        error: "No OVERVIEW artifact found",
      });
      continue;
    }
    
    const contractUpdate: Record<string, any> = {};
    const fieldsPopulated: string[] = [];
    
    // Extract contract type - handle wrapped values
    const contractType = unwrap(overviewData.contractType);
    if (contractType && 
        contractType !== 'Unknown' &&
        (overwrite || !contract.contractType || contract.contractType === 'UNKNOWN')) {
      contractUpdate.contractType = contractType;
      fieldsPopulated.push('contractType');
    }
    
    // Extract parties - handle wrapped values
    if (overviewData.parties && Array.isArray(overviewData.parties)) {
      const getPartyName = (p: any) => unwrap(p.name) || unwrap(p.legalName);
      const getPartyRole = (p: any) => (unwrap(p.role) || '').toLowerCase();
      
      const clientParty = overviewData.parties.find((p: PartyData) => {
        const role = getPartyRole(p);
        return role.includes('client') || role.includes('buyer') || role.includes('customer');
      });
      const supplierParty = overviewData.parties.find((p: PartyData) => {
        const role = getPartyRole(p);
        return role.includes('supplier') || role.includes('vendor') || 
               role.includes('provider') || role.includes('contractor');
      });
      
      const clientName = clientParty ? getPartyName(clientParty) : null;
      const supplierName = supplierParty ? getPartyName(supplierParty) : null;
      
      if (clientName && (overwrite || !contract.clientName)) {
        contractUpdate.clientName = clientName;
        fieldsPopulated.push('clientName');
      }
      if (supplierName && (overwrite || !contract.supplierName)) {
        contractUpdate.supplierName = supplierName;
        fieldsPopulated.push('supplierName');
      }
      
      // If only one party found and no supplier set, use it
      if (!contractUpdate.supplierName && !contract.supplierName && 
          overviewData.parties.length > 0 && !clientParty) {
        const name = getPartyName(overviewData.parties[0]);
        if (name) {
          contractUpdate.supplierName = name;
          fieldsPopulated.push('supplierName');
        }
      }
    }
    
    // Extract total value - handle wrapped values and strings
    const totalValue = unwrapNumber(overviewData.totalValue);
    if (totalValue && totalValue > 0 && (overwrite || !contract.totalValue)) {
      contractUpdate.totalValue = totalValue;
      fieldsPopulated.push('totalValue');
    }
    const currency = unwrap(overviewData.currency);
    if (currency && (overwrite || !contractUpdate.currency)) {
      contractUpdate.currency = currency;
      if (!fieldsPopulated.includes('currency')) fieldsPopulated.push('currency');
    }
    
    // Helper to unwrap and parse dates
    const unwrapDate = (val: any): Date | null => {
      const raw = unwrap(val);
      if (!raw) return null;
      try {
        const date = new Date(raw);
        if (!isNaN(date.getTime()) && date.getFullYear() > 1990) {
          return date;
        }
      } catch { /* ignore */ }
      return null;
    };
    
    // Extract dates - handle wrapped values
    const effDate = unwrapDate(overviewData.effectiveDate) || 
                    unwrapDate(overviewData.effective_date) ||
                    unwrapDate(overviewData.startDate) ||
                    unwrapDate(overviewData.start_date);
    if (effDate && (overwrite || !contract.effectiveDate)) {
      contractUpdate.effectiveDate = effDate;
      fieldsPopulated.push('effectiveDate');
    }
    
    const expDate = unwrapDate(overviewData.expirationDate) || 
                    unwrapDate(overviewData.expiration_date) ||
                    unwrapDate(overviewData.endDate) ||
                    unwrapDate(overviewData.end_date);
    if (expDate && (overwrite || !contract.expirationDate)) {
      contractUpdate.expirationDate = expDate;
      fieldsPopulated.push('expirationDate');
    }
    
    // Extract title from summary
    const summary = unwrap(overviewData.summary);
    if (summary && !contract.contractTitle) {
      const title = summary.split('.')[0].substring(0, 100);
      if (title.length > 10) {
        contractUpdate.contractTitle = title;
        fieldsPopulated.push('contractTitle');
      }
    }
    
    // Apply updates
    if (Object.keys(contractUpdate).length > 0) {
      if (!dryRun) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            ...contractUpdate,
            updatedAt: new Date(),
          },
        });
      }
      totalUpdated++;
      results.push({
        contractId: contract.id,
        fieldsPopulated,
        success: true,
      });
    } else {
      results.push({
        contractId: contract.id,
        fieldsPopulated: [],
        success: true,
      });
    }
  }

  if (!dryRun && totalUpdated > 0) {
    void publishRealtimeEvent({
      event: 'data:refresh',
      data: { tenantId },
      source: 'api:contracts/populate-from-artifacts',
    });

    // Queue RAG re-indexing for all updated contracts
    const updatedContracts = results
      .filter(r => r.success && r.fieldsPopulated.length > 0)
      .map(r => ({ contractId: r.contractId, tenantId }));
    
    if (updatedContracts.length > 0) {
      await queueBatchRAGReindex(updatedContracts, 'populated from artifacts');
    }
  }
  
  return createSuccessResponse(ctx, {
    message: dryRun 
      ? `Would update ${totalUpdated} contracts (dry run)`
      : `Updated ${totalUpdated} contracts`,
    processed: contracts.length,
    updated: totalUpdated,
    dryRun,
    results,
  });
});
