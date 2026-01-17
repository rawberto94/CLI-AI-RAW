/**
 * Activity Feed API
 * Track and retrieve system activity
 */

import { NextRequest, NextResponse } from 'next/server';

type ActivityType = 
  | 'contract_created'
  | 'contract_updated'
  | 'contract_deleted'
  | 'contract_viewed'
  | 'contract_downloaded'
  | 'contract_approved'
  | 'contract_rejected'
  | 'comment_added'
  | 'processing_started'
  | 'processing_completed'
  | 'processing_failed'
  | 'user_login'
  | 'settings_changed'
  | 'import_completed'
  | 'export_completed';

interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  contractId?: string;
  contractName?: string;
}

// In-memory storage for demo (would use database in production)
const activities: ActivityEvent[] = [];
const MAX_ACTIVITIES = 1000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let filteredActivities = [...activities];

    // Filter by contract
    if (contractId) {
      filteredActivities = filteredActivities.filter(a => a.contractId === contractId);
    }

    // Filter by user
    if (userId) {
      filteredActivities = filteredActivities.filter(a => a.userId === userId);
    }

    // Filter by type
    if (type) {
      filteredActivities = filteredActivities.filter(a => a.type === type);
    }

    // Filter by category
    if (category) {
      const categoryTypes: Record<string, ActivityType[]> = {
        contracts: ['contract_created', 'contract_updated', 'contract_deleted', 'contract_viewed', 'contract_downloaded'],
        approvals: ['contract_approved', 'contract_rejected'],
        processing: ['processing_started', 'processing_completed', 'processing_failed'],
        system: ['user_login', 'settings_changed', 'import_completed', 'export_completed'],
      };
      const types = categoryTypes[category];
      if (types) {
        filteredActivities = filteredActivities.filter(a => types.includes(a.type));
      }
    }

    // Sort by timestamp descending
    filteredActivities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Paginate
    const total = filteredActivities.length;
    const paginatedActivities = filteredActivities.slice(offset, offset + limit);

    return NextResponse.json({
      activities: paginatedActivities,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      title,
      description,
      userId,
      userName,
      userEmail,
      userAvatar,
      metadata,
      contractId,
      contractName,
    } = body;

    if (!type || !title || !userId) {
      return NextResponse.json(
        { error: 'type, title, and userId are required' },
        { status: 400 }
      );
    }

    const activity: ActivityEvent = {
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      title,
      description,
      userId,
      userName: userName || 'Unknown User',
      userEmail: userEmail || '',
      userAvatar,
      metadata,
      timestamp: new Date().toISOString(),
      contractId,
      contractName,
    };

    // Add to beginning of array
    activities.unshift(activity);

    // Trim to max size
    if (activities.length > MAX_ACTIVITIES) {
      activities.length = MAX_ACTIVITIES;
    }

    return NextResponse.json({ activity }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}

// Helper function to log activity (can be imported and used elsewhere)
export function logActivity(
  type: ActivityType,
  title: string,
  options: {
    description?: string;
    userId: string;
    userName: string;
    userEmail?: string;
    contractId?: string;
    contractName?: string;
    metadata?: Record<string, any>;
  }
): void {
  const activity: ActivityEvent = {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    title,
    timestamp: new Date().toISOString(),
    ...options,
    userEmail: options.userEmail || '',
  };

  activities.unshift(activity);

  if (activities.length > MAX_ACTIVITIES) {
    activities.length = MAX_ACTIVITIES;
  }
}
