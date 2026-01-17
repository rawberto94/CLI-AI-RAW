import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/admin/data-connections/[id]
 * Delete a data connection
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Get existing settings
    const settings = await prisma.tenantSettings.findFirst({
      where: { tenantId },
    });

    if (!settings?.customFields) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const customFields = typeof settings.customFields === 'string' 
      ? JSON.parse(settings.customFields) 
      : settings.customFields;
    
    const existingConnections = customFields.dataConnections || [];
    const updatedConnections = existingConnections.filter((c: { id: string }) => c.id !== id);

    if (existingConnections.length === updatedConnections.length) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Update settings
    await prisma.tenantSettings.update({
      where: { id: settings.id },
      data: {
        customFields: JSON.stringify({
          ...customFields,
          dataConnections: updatedConnections,
        }),
      },
    });

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to delete connection' },
      { status: 500 }
    );
  }
}
