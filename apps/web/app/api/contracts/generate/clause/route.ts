/**
 * Contract Clause Generation API
 * 
 * Generate individual clauses for contracts
 * 
 * @module api/contracts/generate/clause
 */

import { NextRequest } from 'next/server';
import { 
  getContractGenerationService, 
  ContractTemplateType 
} from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

/**
 * POST /api/contracts/generate/clause
 * 
 * Generate a specific clause for a contract
 */
export const POST = withAuthApiHandler(async (request, ctx) => {

  const body = await request.json();
  const {
    clauseType,
    contractType,
    existingClauses,
    variables,
    options,
  } = body;

  if (!clauseType || typeof clauseType !== 'string') {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Clause type is required', 400);
  }

  if (!contractType || typeof contractType !== 'string') {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Contract type is required', 400);
  }

  const generationService = getContractGenerationService();

  const result = await generationService.generateClause(
    clauseType,
    {
      contractType: contractType as ContractTemplateType,
      existingClauses,
      variables,
      tenantId: ctx.tenantId,
    },
    options
  );

  return createSuccessResponse(ctx, {
    clause: result,
  });
});
