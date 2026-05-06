/**
 * Contract Comments API
 * CRUD operations for contract comments - Database persisted
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/api-middleware';
import {
  deleteContractComment,
  getContractComments,
  postContractComment,
  putContractComment,
} from '@/lib/contracts/server/comments';

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractComments(request, ctx);
});

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractComment(request, ctx);
});

export const PUT = withContractApiHandler(async (request, ctx) => {
  return putContractComment(request, ctx);
});

export const DELETE = withContractApiHandler(async (request, ctx) => {
  return deleteContractComment(request, ctx);
});
