/**
 * Admin IP Allowlist - Single Entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

// DELETE - Remove IP from allowlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true },
    });

    if (!user || !['admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get current settings
    const config = await prisma.tenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });

    const securitySettings = (config?.securitySettings as any) || {};
    const entries: any[] = securitySettings.ipAllowlist || [];

    // Find and remove entry
    const entryIndex = entries.findIndex(e => e.id === params.id);
    if (entryIndex === -1) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const removedEntry = entries[entryIndex];
    entries.splice(entryIndex, 1);

    // Update config
    await prisma.tenantConfig.update({
      where: { tenantId: user.tenantId },
      data: {
        securitySettings: { ...securitySettings, ipAllowlist: entries },
      },
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: session.user.id,
        action: 'IP_ALLOWLIST_REMOVED',
        resourceType: 'security',
        resource: params.id,
        details: { ip: removedEntry.ip },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove IP from allowlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
