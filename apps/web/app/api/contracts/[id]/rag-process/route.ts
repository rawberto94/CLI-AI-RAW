import { NextRequest } from 'next/server'
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postContractRagProcess } from '@/lib/contracts/server/rag';

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return postContractRagProcess(request, ctx, contractId);
})
