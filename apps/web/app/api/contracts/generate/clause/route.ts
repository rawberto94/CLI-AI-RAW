/**
 * Contract Clause Generation API
 * 
 * Generate individual clauses for contracts
 * 
 * @module api/contracts/generate/clause
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/tenant-server';
import { 
  getContractGenerationService, 
  ContractTemplateType 
} from '@repo/data-orchestration/services/contract-generation.service';

/**
 * POST /api/contracts/generate/clause
 * 
 * Generate a specific clause for a contract
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      clauseType,
      contractType,
      existingClauses,
      variables,
      options,
    } = body;

    if (!clauseType || typeof clauseType !== 'string') {
      return NextResponse.json(
        { error: 'Clause type is required' },
        { status: 400 }
      );
    }

    if (!contractType || typeof contractType !== 'string') {
      return NextResponse.json(
        { error: 'Contract type is required' },
        { status: 400 }
      );
    }

    const generationService = getContractGenerationService();

    const result = await generationService.generateClause(
      clauseType,
      {
        contractType: contractType as ContractTemplateType,
        existingClauses,
        variables,
        tenantId: getSessionTenantId(session),
      },
      options
    );

    return NextResponse.json({
      success: true,
      clause: result,
    });
  } catch (error) {
    console.error('Clause generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate clause' },
      { status: 500 }
    );
  }
}
