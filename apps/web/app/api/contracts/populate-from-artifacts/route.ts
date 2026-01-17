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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantIdFromRequest } from "@/lib/tenant-server";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { queueBatchRAGReindex } from "@/lib/rag/reindex-helper";

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let tenantId: string;
    try {
      tenantId = await getTenantIdFromRequest(request);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
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
      return NextResponse.json({
        success: true,
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
      
      // Extract contract type
      if (overviewData.contractType && 
          overviewData.contractType !== 'Unknown' &&
          (overwrite || !contract.contractType || contract.contractType === 'UNKNOWN')) {
        contractUpdate.contractType = overviewData.contractType;
        fieldsPopulated.push('contractType');
      }
      
      // Extract parties
      if (overviewData.parties && Array.isArray(overviewData.parties)) {
        const clientParty = overviewData.parties.find((p: PartyData) => 
          p.role?.toLowerCase().includes('client') || 
          p.role?.toLowerCase().includes('buyer') ||
          p.role?.toLowerCase().includes('customer')
        );
        const supplierParty = overviewData.parties.find((p: PartyData) => 
          p.role?.toLowerCase().includes('supplier') || 
          p.role?.toLowerCase().includes('vendor') ||
          p.role?.toLowerCase().includes('provider') ||
          p.role?.toLowerCase().includes('contractor')
        );
        
        if (clientParty?.name && (overwrite || !contract.clientName)) {
          contractUpdate.clientName = clientParty.name;
          fieldsPopulated.push('clientName');
        }
        if (supplierParty?.name && (overwrite || !contract.supplierName)) {
          contractUpdate.supplierName = supplierParty.name;
          fieldsPopulated.push('supplierName');
        }
        
        // If only one party found and no supplier set, use it
        if (!contractUpdate.supplierName && !contract.supplierName && 
            overviewData.parties.length > 0 && !clientParty) {
          contractUpdate.supplierName = overviewData.parties[0].name;
          fieldsPopulated.push('supplierName');
        }
      }
      
      // Extract total value
      if (overviewData.totalValue && 
          typeof overviewData.totalValue === 'number' && 
          overviewData.totalValue > 0 &&
          (overwrite || !contract.totalValue)) {
        contractUpdate.totalValue = overviewData.totalValue;
        fieldsPopulated.push('totalValue');
      }
      if (overviewData.currency && (overwrite || !contractUpdate.currency)) {
        contractUpdate.currency = overviewData.currency;
        if (!fieldsPopulated.includes('currency')) fieldsPopulated.push('currency');
      }
      
      // Extract dates
      if (overviewData.effectiveDate && (overwrite || !contract.effectiveDate)) {
        try {
          const effDate = new Date(overviewData.effectiveDate);
          if (!isNaN(effDate.getTime()) && effDate.getFullYear() > 1990) {
            contractUpdate.effectiveDate = effDate;
            fieldsPopulated.push('effectiveDate');
          }
        } catch { /* ignore */ }
      }
      if (overviewData.expirationDate && (overwrite || !contract.expirationDate)) {
        try {
          const expDate = new Date(overviewData.expirationDate);
          if (!isNaN(expDate.getTime()) && expDate.getFullYear() > 1990) {
            contractUpdate.expirationDate = expDate;
            fieldsPopulated.push('expirationDate');
          }
        } catch { /* ignore */ }
      }
      
      // Extract title from summary
      if (overviewData.summary && !contract.contractTitle) {
        const title = overviewData.summary.split('.')[0].substring(0, 100);
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
    
    return NextResponse.json({
      success: true,
      message: dryRun 
        ? `Would update ${totalUpdated} contracts (dry run)`
        : `Updated ${totalUpdated} contracts`,
      processed: contracts.length,
      updated: totalUpdated,
      dryRun,
      results,
    });
    
  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
