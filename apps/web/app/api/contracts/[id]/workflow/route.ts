import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  deleteContractWorkflow,
  getContractWorkflow,
  postContractWorkflow,
  putContractWorkflow,
} from '@/lib/contracts/server/workflow';

export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractWorkflow(ctx, contractId);
})

export const dynamic = 'force-dynamic';

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postContractWorkflow(request, ctx, contractId);
})

export const PUT = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return putContractWorkflow(request, ctx, contractId);
})

export const DELETE = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return deleteContractWorkflow(ctx, contractId);
})
