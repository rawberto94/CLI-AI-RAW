/**
 * Taxonomy Actions Handler
 * Handles taxonomy/category operations
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';
import { prisma } from '@/lib/prisma';

export async function handleTaxonomyActions(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action } = intent;

  // TODO: Extract from chat/route.ts
  return {
    success: false,
    message: `Taxonomy action '${action}' not yet implemented in refactored structure`,
  };
}
