import { NextRequest, NextResponse } from 'next/server';

// Mock portal data
const mockPortalData = {
  supplier: {
    id: 'sup1',
    name: 'TechVendor Solutions Inc.',
    contact: 'Roberto Ostojic',
    email: 'roberto@techvendor.com',
    phone: '+1 (555) 123-4567',
    rating: 4.7,
    activeContracts: 3,
  },
  contracts: [
    {
      id: 'c1',
      name: 'Master Services Agreement',
      status: 'pending-signature',
      value: 1200000,
      expiryDate: '2025-04-01',
      actionRequired: true,
    },
    {
      id: 'c2',
      name: 'Cloud Services SLA',
      status: 'in-negotiation',
      value: 450000,
      expiryDate: '2025-06-01',
      actionRequired: true,
    },
  ],
  pendingTasks: [
    {
      id: 't1',
      title: 'Sign Master Services Agreement',
      type: 'signature',
      dueDate: '2024-03-15',
      priority: 'critical',
    },
    {
      id: 't2',
      title: 'Upload Updated Insurance Certificate',
      type: 'document',
      dueDate: '2024-03-16',
      priority: 'high',
    },
  ],
  unreadMessages: 2,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const section = searchParams.get('section');

  // Validate magic link token (mock)
  if (token && token.length < 10) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  if (section) {
    switch (section) {
      case 'contracts':
        return NextResponse.json({
          success: true,
          data: { contracts: mockPortalData.contracts },
        });
      case 'tasks':
        return NextResponse.json({
          success: true,
          data: { tasks: mockPortalData.pendingTasks },
        });
      default:
        return NextResponse.json({
          success: true,
          data: mockPortalData,
        });
    }
  }

  return NextResponse.json({
    success: true,
    data: mockPortalData,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, contractId, taskId, message, document } = body;

    if (action === 'sign') {
      return NextResponse.json({
        success: true,
        message: 'Contract signed successfully',
        data: {
          contractId,
          signedAt: new Date().toISOString(),
          signatureId: `sig-${Date.now()}`,
        },
      });
    }

    if (action === 'upload') {
      return NextResponse.json({
        success: true,
        message: 'Document uploaded successfully',
        data: {
          documentId: `doc-${Date.now()}`,
          uploadedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'send-message') {
      return NextResponse.json({
        success: true,
        message: 'Message sent',
        data: {
          messageId: `msg-${Date.now()}`,
          sentAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'complete-task') {
      return NextResponse.json({
        success: true,
        message: 'Task completed',
        data: {
          taskId,
          completedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'generate-magic-link') {
      // Generate magic link for supplier access
      return NextResponse.json({
        success: true,
        data: {
          magicLink: `https://app.company.com/portal?token=${Buffer.from(Date.now().toString()).toString('base64')}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
