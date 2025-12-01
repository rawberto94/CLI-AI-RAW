/**
 * Chunked Upload API - Initialize (DEPRECATED ALIAS)
 * POST /api/contracts/upload/initialize
 * 
 * @deprecated Use /api/contracts/upload/init instead.
 * This endpoint exists only for backward compatibility and will be removed in a future version.
 */

import { NextRequest } from 'next/server';
import { POST as InitHandler } from '../init/route';

/**
 * @deprecated Use POST /api/contracts/upload/init instead
 */
export async function POST(req: NextRequest) {
  console.warn("DEPRECATED: /api/contracts/upload/initialize is deprecated. Use /api/contracts/upload/init instead.");
  return InitHandler(req);
}
