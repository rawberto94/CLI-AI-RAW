import { NextRequest, NextResponse } from 'next/server';

// Mock integration data
const mockIntegrations = [
  {
    id: 'int1',
    name: 'SAP S/4HANA',
    type: 'erp',
    status: 'connected',
    lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    recordsProcessed: 15420,
    health: { uptime: 99.8, errors24h: 2 },
  },
  {
    id: 'int2',
    name: 'Coupa Procurement',
    type: 'procurement',
    status: 'connected',
    lastSync: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    recordsProcessed: 8930,
    health: { uptime: 99.5, errors24h: 0 },
  },
  {
    id: 'int3',
    name: 'DocuSign',
    type: 'signature',
    status: 'connected',
    lastSync: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    recordsProcessed: 2340,
    health: { uptime: 100, errors24h: 0 },
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get('id');
  const type = searchParams.get('type');

  if (integrationId) {
    const integration = mockIntegrations.find(i => i.id === integrationId);
    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Integration not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: integration,
    });
  }

  let integrations = mockIntegrations;
  if (type) {
    integrations = integrations.filter(i => i.type === type);
  }

  return NextResponse.json({
    success: true,
    data: {
      integrations,
      stats: {
        total: mockIntegrations.length,
        connected: mockIntegrations.filter(i => i.status === 'connected').length,
        totalRecords: mockIntegrations.reduce((sum, i) => sum + i.recordsProcessed, 0),
      },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, integrationId, config } = body;

    if (action === 'connect') {
      return NextResponse.json({
        success: true,
        message: 'Integration connected',
        data: {
          integrationId: integrationId || `int-${Date.now()}`,
          connectedAt: new Date().toISOString(),
          status: 'connected',
        },
      });
    }

    if (action === 'disconnect') {
      return NextResponse.json({
        success: true,
        message: 'Integration disconnected',
        data: {
          integrationId,
          disconnectedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'sync') {
      return NextResponse.json({
        success: true,
        message: 'Sync initiated',
        data: {
          integrationId,
          syncId: `sync-${Date.now()}`,
          startedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'test') {
      // Test connection
      return NextResponse.json({
        success: true,
        data: {
          integrationId,
          testResult: 'success',
          latency: 245,
          testedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'configure') {
      return NextResponse.json({
        success: true,
        message: 'Configuration updated',
        data: {
          integrationId,
          config,
          updatedAt: new Date().toISOString(),
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
