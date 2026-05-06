import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractStatus, patchContractStatus } from '@/lib/contracts/server/lifecycle';

export const GET = withContractApiHandler(async (_request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return getContractStatus(ctx, contractId);
})

export const PATCH = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return patchContractStatus(request, ctx, contractId);
})
