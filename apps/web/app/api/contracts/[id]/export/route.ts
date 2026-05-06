import {
  type ContractApiContext,
  withContractSessionApiHandler,
} from '@/lib/contracts/server/context';
import { getContractExport } from '@/lib/contracts/server/export';

type ExportRouteContext = ContractApiContext & {
  params: Promise<{ id: string }>;
};

export const GET = withContractSessionApiHandler(async (request, ctx) => {
  const { id } = await (ctx as ExportRouteContext).params;
  return getContractExport(request, ctx, id);
});