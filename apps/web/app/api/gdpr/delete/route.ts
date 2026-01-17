/**
 * GDPR Account Deletion API Routes
 * 
 * POST   /api/gdpr/delete - Request account deletion (30 day grace period)
 * DELETE /api/gdpr/delete - Cancel deletion request
 */

import { NextRequest } from 'next/server';
import { 
  requestAccountDeletion,
  cancelAccountDeletion,
} from '@/lib/gdpr/data-rights';

// Request account deletion
export async function POST(request: NextRequest) {
  return requestAccountDeletion(request);
}

// Cancel deletion request
export async function DELETE(request: NextRequest) {
  return cancelAccountDeletion(request);
}
