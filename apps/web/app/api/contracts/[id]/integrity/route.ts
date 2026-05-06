/**
 * Contract Integrity Check API
 * GET /api/contracts/[id]/integrity - Validate contract data integrity
 * 
 * Checks 7 categories:
 * 1. Date consistency
 * 2. Value validation
 * 3. Taxonomy classification
 * 4. Hierarchy integrity
 * 5. Processing status
 * 6. Artifacts presence
 * 7. Metadata completeness
 */

import { NextRequest, NextResponse } from 'next/server'
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractIntegrityReport } from '@/lib/contracts/server/integrity';

export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string }
  const contractId = params.id
  return getContractIntegrityReport(request, ctx, contractId);
});
