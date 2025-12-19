import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

/**
 * GET /api/admin/data-connections
 * List all data connections for the tenant
 */
export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as { tenantId?: string }).tenantId;
    const userRole = (session.user as { role?: string }).role;
    
    // Only admins can view connections
    if (!tenantId || !['admin', 'owner'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For now, we'll store connections in a simple format
    // In production, you'd have a proper DataConnection model
    const connections = await prisma.tenantSettings.findFirst({
      where: { tenantId },
      select: { 
        id: true,
        customFields: true,
      },
    });

    let dataConnections: any[] = [];
    
    if (connections?.customFields) {
      try {
        const customFields = typeof connections.customFields === 'string' 
          ? JSON.parse(connections.customFields) 
          : connections.customFields;
        dataConnections = customFields.dataConnections || [];
      } catch (e) {
        dataConnections = [];
      }
    }

    return NextResponse.json({
      success: true,
      connections: dataConnections,
    });

  } catch (error) {
    console.error('Data connections GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/data-connections
 * Create a new data connection
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as { tenantId?: string }).tenantId;
    const userRole = (session.user as { role?: string }).role;
    
    if (!tenantId || !['admin', 'owner'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { type, name, config, syncMode, autoSync, syncFrequency } = body;

    if (!type || !name) {
      return NextResponse.json({ error: 'Type and name are required' }, { status: 400 });
    }

    // Create new connection object
    const newConnection = {
      id: randomUUID(),
      type,
      name,
      status: 'disconnected',
      host: config.host,
      database: config.database,
      syncMode: syncMode || 'reference',
      autoSync: autoSync !== false,
      syncFrequency: syncFrequency || 'daily',
      contractTableName: config.contractTableName,
      createdAt: new Date().toISOString(),
      // Note: In production, encrypt sensitive fields before storing
      encryptedConfig: Buffer.from(JSON.stringify({
        ...config,
        // Remove sensitive fields from plain text
        password: '***ENCRYPTED***',
        secretAccessKey: '***ENCRYPTED***',
        clientSecret: '***ENCRYPTED***',
      })).toString('base64'),
    };

    // Get existing settings
    const settings = await prisma.tenantSettings.findFirst({
      where: { tenantId },
    });

    let existingConnections: any[] = [];
    
    if (settings?.customFields) {
      try {
        const customFields = typeof settings.customFields === 'string' 
          ? JSON.parse(settings.customFields) 
          : settings.customFields;
        existingConnections = customFields.dataConnections || [];
      } catch (e) {
        existingConnections = [];
      }
    }

    // Add new connection
    const updatedConnections = [...existingConnections, newConnection];

    // Update or create settings
    if (settings) {
      const existingCustomFields = typeof settings.customFields === 'string' 
        ? JSON.parse(settings.customFields) 
        : (settings.customFields || {});
      
      await prisma.tenantSettings.update({
        where: { id: settings.id },
        data: {
          customFields: JSON.stringify({
            ...existingCustomFields,
            dataConnections: updatedConnections,
          }),
        },
      });
    } else {
      await prisma.tenantSettings.create({
        data: {
          tenantId,
          customFields: JSON.stringify({
            dataConnections: updatedConnections,
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      connection: {
        ...newConnection,
        encryptedConfig: undefined, // Don't return encrypted config
      },
    });

  } catch (error) {
    console.error('Data connection create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create connection' },
      { status: 500 }
    );
  }
}
