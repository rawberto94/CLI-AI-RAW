/**
 * Admin IP Allowlist API
 * Manage IP-based access restrictions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

interface IPAllowlistEntry {
  id: string;
  ip: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

// GET - List IP allowlist entries
export async function GET(request: NextRequest) {
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

    // Get tenant config with IP allowlist
    const config = await prisma.tenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });

    const securitySettings = config?.securitySettings as any || {};
    const entries = securitySettings.ipAllowlist || [];

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Failed to fetch IP allowlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add IP to allowlist
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true, email: true },
    });

    if (!user || !['admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { ip, description } = body;

    if (!ip) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
    }

    // Validate IP format (simple validation)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(ip)) {
      return NextResponse.json({ error: 'Invalid IP address format' }, { status: 400 });
    }

    // Get current settings
    const config = await prisma.tenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });

    const securitySettings = (config?.securitySettings as any) || {};
    const entries: IPAllowlistEntry[] = securitySettings.ipAllowlist || [];

    // Check for duplicate
    if (entries.some(e => e.ip === ip)) {
      return NextResponse.json({ error: 'IP already in allowlist' }, { status: 400 });
    }

    // Add new entry
    const newEntry: IPAllowlistEntry = {
      id: crypto.randomUUID(),
      ip,
      description: description || '',
      createdAt: new Date().toISOString(),
      createdBy: user.email,
    };

    entries.push(newEntry);

    // Update config
    await prisma.tenantConfig.upsert({
      where: { tenantId: user.tenantId },
      update: {
        securitySettings: { ...securitySettings, ipAllowlist: entries },
      },
      create: {
        tenantId: user.tenantId,
        securitySettings: { ipAllowlist: entries },
      },
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: session.user.id,
        action: 'IP_ALLOWLIST_ADDED',
        resourceType: 'security',
        resourceId: newEntry.id,
        details: { ip, description },
      },
    });

    return NextResponse.json({ success: true, entry: newEntry });
  } catch (error) {
    console.error('Failed to add IP to allowlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
