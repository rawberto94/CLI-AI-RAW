/**
 * GDPR Data Subject Rights API Routes
 * 
 * POST /api/gdpr/export - Request data export
 * GET  /api/gdpr/export - Get export status
 * POST /api/gdpr/delete - Request account deletion
 * DELETE /api/gdpr/delete - Cancel deletion request
 */

import { NextRequest } from 'next/server';
import { 
  requestDataExport, 
  getExportStatus,
  requestAccountDeletion,
  cancelAccountDeletion,
} from '@/lib/gdpr/data-rights';

// Data Export
export async function POST(request: NextRequest) {
  return requestDataExport(request);
}

export async function GET(request: NextRequest) {
  return getExportStatus(request);
}
