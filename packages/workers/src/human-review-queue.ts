/**
 * Human Review Queue Service
 * 
 * Routes low-confidence OCR documents for manual review.
 * Tracks review status, assignments, and corrections.
 */

import pino from 'pino';

const logger = pino({ name: 'human-review-queue' });

// ============================================================================
// TYPES
// ============================================================================

export type ReviewPriority = 'critical' | 'high' | 'medium' | 'low';
export type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'escalated';
export type ReviewType = 'ocr_quality' | 'data_verification' | 'compliance_check' | 'legal_review';

export interface ReviewItem {
  id: string;
  contractId: string;
  tenantId: string;
  type: ReviewType;
  priority: ReviewPriority;
  status: ReviewStatus;
  
  // OCR Quality Data
  ocrConfidence: number;
  lowConfidenceRegions: Array<{
    start: number;
    end: number;
    text: string;
    avgConfidence: number;
    fieldType?: string;
    correctedText?: string;
    verifiedAt?: Date;
    verifiedBy?: string;
  }>;
  
  // Metadata
  documentName: string;
  documentType?: string;
  pageCount?: number;
  extractedFields?: Record<string, {
    value: string;
    confidence: number;
    verified?: boolean;
  }>;
  
  // Assignment
  assignedTo?: string;
  assignedAt?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Review Results
  corrections?: Array<{
    field: string;
    originalValue: string;
    correctedValue: string;
    reason?: string;
    timestamp: Date;
    reviewerId: string;
  }>;
  notes?: string;
  reviewScore?: number; // 1-5 quality rating after review
}

export interface ReviewQueueFilters {
  status?: ReviewStatus[];
  priority?: ReviewPriority[];
  type?: ReviewType[];
  assignedTo?: string;
  tenantId?: string;
  minConfidence?: number;
  maxConfidence?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ReviewQueueStats {
  total: number;
  byStatus: Record<ReviewStatus, number>;
  byPriority: Record<ReviewPriority, number>;
  avgTimeToComplete: number; // in hours
  completedToday: number;
  avgConfidenceImprovement: number;
}

export interface CreateReviewRequest {
  contractId: string;
  tenantId: string;
  type: ReviewType;
  ocrConfidence: number;
  lowConfidenceRegions: ReviewItem['lowConfidenceRegions'];
  documentName: string;
  documentType?: string;
  pageCount?: number;
  extractedFields?: ReviewItem['extractedFields'];
  notes?: string;
}

// ============================================================================
// PRIORITY CALCULATION
// ============================================================================

/**
 * Calculate review priority based on confidence and other factors
 */
export function calculateReviewPriority(
  confidence: number,
  lowConfidenceRegionCount: number,
  documentType?: string,
  hasFinancialData?: boolean
): ReviewPriority {
  // Critical: Very low confidence or high-value documents
  if (confidence < 0.3) return 'critical';
  if (hasFinancialData && confidence < 0.5) return 'critical';
  
  // High: Low confidence or many issues
  if (confidence < 0.5) return 'high';
  if (lowConfidenceRegionCount > 10) return 'high';
  
  // Medium: Moderate issues
  if (confidence < 0.7) return 'medium';
  if (lowConfidenceRegionCount > 5) return 'medium';
  
  // Low: Minor issues only
  return 'low';
}

/**
 * Determine if a document needs review based on thresholds
 */
export function needsHumanReview(
  confidence: number,
  lowConfidenceRegionCount: number,
  options: {
    confidenceThreshold?: number;
    regionCountThreshold?: number;
    alwaysReviewTypes?: string[];
    documentType?: string;
  } = {}
): { needsReview: boolean; reason?: string } {
  const {
    confidenceThreshold = 0.7,
    regionCountThreshold = 5,
    alwaysReviewTypes = ['MASTER_AGREEMENT', 'MERGER_ACQUISITION'],
    documentType,
  } = options;
  
  // Always review certain document types
  if (documentType && alwaysReviewTypes.includes(documentType)) {
    return { needsReview: true, reason: 'Document type requires review' };
  }
  
  // Low overall confidence
  if (confidence < confidenceThreshold) {
    return { 
      needsReview: true, 
      reason: `Low OCR confidence (${Math.round(confidence * 100)}%)` 
    };
  }
  
  // Many low-confidence regions
  if (lowConfidenceRegionCount > regionCountThreshold) {
    return { 
      needsReview: true, 
      reason: `${lowConfidenceRegionCount} sections need verification` 
    };
  }
  
  return { needsReview: false };
}

// ============================================================================
// IN-MEMORY QUEUE (Replace with database in production)
// ============================================================================

const reviewQueue = new Map<string, ReviewItem>();
const queueByTenant = new Map<string, Set<string>>();
const queueByStatus = new Map<ReviewStatus, Set<string>>();

// Initialize status sets
(['pending', 'in_progress', 'completed', 'rejected', 'escalated'] as ReviewStatus[]).forEach(status => {
  queueByStatus.set(status, new Set());
});

// ============================================================================
// QUEUE OPERATIONS
// ============================================================================

/**
 * Add a document to the review queue
 */
export async function addToReviewQueue(request: CreateReviewRequest): Promise<ReviewItem> {
  const id = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const priority = calculateReviewPriority(
    request.ocrConfidence,
    request.lowConfidenceRegions.length,
    request.documentType,
    // Check if has financial data
    request.extractedFields && Object.keys(request.extractedFields).some(k => 
      k.toLowerCase().includes('amount') || k.toLowerCase().includes('value')
    )
  );
  
  const item: ReviewItem = {
    id,
    contractId: request.contractId,
    tenantId: request.tenantId,
    type: request.type,
    priority,
    status: 'pending',
    ocrConfidence: request.ocrConfidence,
    lowConfidenceRegions: request.lowConfidenceRegions,
    documentName: request.documentName,
    documentType: request.documentType,
    pageCount: request.pageCount,
    extractedFields: request.extractedFields,
    notes: request.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  // Store in queue
  reviewQueue.set(id, item);
  
  // Index by tenant
  if (!queueByTenant.has(request.tenantId)) {
    queueByTenant.set(request.tenantId, new Set());
  }
  queueByTenant.get(request.tenantId)!.add(id);
  
  // Index by status
  queueByStatus.get('pending')!.add(id);
  
  logger.info({
    reviewId: id,
    contractId: request.contractId,
    priority,
    confidence: request.ocrConfidence,
    regions: request.lowConfidenceRegions.length,
  }, 'Document added to review queue');
  
  return item;
}

/**
 * Get review items with filters
 */
export async function getReviewQueue(
  filters: ReviewQueueFilters = {},
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 20 }
): Promise<{ items: ReviewItem[]; total: number }> {
  let items = Array.from(reviewQueue.values());
  
  // Apply filters
  if (filters.status?.length) {
    items = items.filter(i => filters.status!.includes(i.status));
  }
  if (filters.priority?.length) {
    items = items.filter(i => filters.priority!.includes(i.priority));
  }
  if (filters.type?.length) {
    items = items.filter(i => filters.type!.includes(i.type));
  }
  if (filters.tenantId) {
    items = items.filter(i => i.tenantId === filters.tenantId);
  }
  if (filters.assignedTo) {
    items = items.filter(i => i.assignedTo === filters.assignedTo);
  }
  if (filters.minConfidence !== undefined) {
    items = items.filter(i => i.ocrConfidence >= filters.minConfidence!);
  }
  if (filters.maxConfidence !== undefined) {
    items = items.filter(i => i.ocrConfidence <= filters.maxConfidence!);
  }
  if (filters.dateFrom) {
    items = items.filter(i => i.createdAt >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    items = items.filter(i => i.createdAt <= filters.dateTo!);
  }
  
  // Sort by priority and date
  const priorityOrder: Record<ReviewPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  
  items.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  
  // Paginate
  const total = items.length;
  const start = (pagination.page - 1) * pagination.pageSize;
  items = items.slice(start, start + pagination.pageSize);
  
  return { items, total };
}

/**
 * Get a single review item
 */
export async function getReviewItem(id: string): Promise<ReviewItem | null> {
  return reviewQueue.get(id) || null;
}

/**
 * Assign a review item to a user
 */
export async function assignReview(
  id: string,
  userId: string
): Promise<ReviewItem | null> {
  const item = reviewQueue.get(id);
  if (!item) return null;
  
  // Update status indexes
  queueByStatus.get(item.status)!.delete(id);
  queueByStatus.get('in_progress')!.add(id);
  
  // Update item
  item.status = 'in_progress';
  item.assignedTo = userId;
  item.assignedAt = new Date();
  item.updatedAt = new Date();
  
  logger.info({
    reviewId: id,
    assignedTo: userId,
  }, 'Review item assigned');
  
  return item;
}

/**
 * Submit review corrections
 */
export async function submitReviewCorrections(
  id: string,
  reviewerId: string,
  corrections: Array<{
    field: string;
    originalValue: string;
    correctedValue: string;
    reason?: string;
  }>,
  notes?: string,
  reviewScore?: number
): Promise<ReviewItem | null> {
  const item = reviewQueue.get(id);
  if (!item) return null;
  
  // Update status indexes
  queueByStatus.get(item.status)!.delete(id);
  queueByStatus.get('completed')!.add(id);
  
  // Update item
  item.status = 'completed';
  item.completedAt = new Date();
  item.updatedAt = new Date();
  item.corrections = corrections.map(c => ({
    ...c,
    timestamp: new Date(),
    reviewerId,
  }));
  item.notes = notes;
  item.reviewScore = reviewScore;
  
  // Mark corrected regions as verified
  if (item.lowConfidenceRegions) {
    item.lowConfidenceRegions = item.lowConfidenceRegions.map(region => ({
      ...region,
      verifiedAt: new Date(),
      verifiedBy: reviewerId,
    }));
  }
  
  logger.info({
    reviewId: id,
    reviewerId,
    correctionsCount: corrections.length,
    reviewScore,
  }, 'Review completed');
  
  return item;
}

/**
 * Escalate a review item
 */
export async function escalateReview(
  id: string,
  reason: string,
  escalatedBy: string
): Promise<ReviewItem | null> {
  const item = reviewQueue.get(id);
  if (!item) return null;
  
  // Update status indexes
  queueByStatus.get(item.status)!.delete(id);
  queueByStatus.get('escalated')!.add(id);
  
  // Update item
  item.status = 'escalated';
  item.priority = 'critical'; // Auto-escalate priority
  item.updatedAt = new Date();
  item.notes = (item.notes ? item.notes + '\n\n' : '') + 
    `ESCALATED by ${escalatedBy}: ${reason}`;
  
  logger.warn({
    reviewId: id,
    escalatedBy,
    reason,
  }, 'Review item escalated');
  
  return item;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(tenantId?: string): Promise<ReviewQueueStats> {
  let items = Array.from(reviewQueue.values());
  
  if (tenantId) {
    items = items.filter(i => i.tenantId === tenantId);
  }
  
  const byStatus: Record<ReviewStatus, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    rejected: 0,
    escalated: 0,
  };
  
  const byPriority: Record<ReviewPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  
  let totalCompletionTime = 0;
  let completedCount = 0;
  let completedToday = 0;
  let totalConfidenceImprovement = 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (const item of items) {
    byStatus[item.status]++;
    byPriority[item.priority]++;
    
    if (item.status === 'completed' && item.completedAt) {
      const completionTime = item.completedAt.getTime() - item.createdAt.getTime();
      totalCompletionTime += completionTime;
      completedCount++;
      
      if (item.completedAt >= today) {
        completedToday++;
      }
      
      // Estimate confidence improvement based on corrections
      if (item.corrections?.length) {
        totalConfidenceImprovement += 0.1 * item.corrections.length;
      }
    }
  }
  
  return {
    total: items.length,
    byStatus,
    byPriority,
    avgTimeToComplete: completedCount > 0 
      ? (totalCompletionTime / completedCount) / (1000 * 60 * 60) // Convert to hours
      : 0,
    completedToday,
    avgConfidenceImprovement: completedCount > 0
      ? totalConfidenceImprovement / completedCount
      : 0,
  };
}

/**
 * Get next item for review (auto-assignment)
 */
export async function getNextReviewItem(
  reviewerId: string,
  preferences?: {
    types?: ReviewType[];
    maxPriority?: ReviewPriority;
  }
): Promise<ReviewItem | null> {
  const priorityOrder: ReviewPriority[] = ['critical', 'high', 'medium', 'low'];
  const maxPriorityIndex = preferences?.maxPriority 
    ? priorityOrder.indexOf(preferences.maxPriority)
    : 3;
  
  // Get pending items sorted by priority
  const pendingIds = Array.from(queueByStatus.get('pending')!);
  let candidates = pendingIds
    .map(id => reviewQueue.get(id)!)
    .filter(item => {
      // Check priority
      const priorityIndex = priorityOrder.indexOf(item.priority);
      if (priorityIndex > maxPriorityIndex) return false;
      
      // Check type preference
      if (preferences?.types?.length && !preferences.types.includes(item.type)) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      const priorityDiff = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  
  if (candidates.length === 0) return null;
  
  // Assign the first candidate
  const next = candidates[0];
  if (next) {
    return await assignReview(next.id, reviewerId);
  }
  
  return null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const HumanReviewQueue = {
  add: addToReviewQueue,
  get: getReviewQueue,
  getItem: getReviewItem,
  assign: assignReview,
  submitCorrections: submitReviewCorrections,
  escalate: escalateReview,
  getStats: getQueueStats,
  getNext: getNextReviewItem,
  needsReview: needsHumanReview,
  calculatePriority: calculateReviewPriority,
};

export default HumanReviewQueue;
