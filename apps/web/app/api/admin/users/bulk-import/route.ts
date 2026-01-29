/**
 * Bulk User Import API
 * 
 * POST /api/admin/users/bulk-import - Import multiple users from CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction } from '@/lib/security/audit';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

interface ImportUser {
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  department?: string;
  groupIds?: string[];
}

interface ImportResult {
  email: string;
  status: 'created' | 'invited' | 'skipped' | 'error';
  reason?: string;
  userId?: string;
}

// Validate email format
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Parse CSV content
function parseCSV(content: string): ImportUser[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const emailIndex = headers.findIndex(h => h === 'email');
  const firstNameIndex = headers.findIndex(h => ['firstname', 'first_name', 'first name'].includes(h));
  const lastNameIndex = headers.findIndex(h => ['lastname', 'last_name', 'last name'].includes(h));
  const roleIndex = headers.findIndex(h => h === 'role');
  const departmentIndex = headers.findIndex(h => h === 'department');
  const groupsIndex = headers.findIndex(h => ['groups', 'group_ids', 'groupids'].includes(h));
  
  if (emailIndex === -1) {
    throw new Error('CSV must have an "email" column');
  }
  
  const users: ImportUser[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values[emailIndex]?.trim()) continue;
    
    users.push({
      email: values[emailIndex].trim().toLowerCase(),
      firstName: firstNameIndex >= 0 ? values[firstNameIndex]?.trim() : undefined,
      lastName: lastNameIndex >= 0 ? values[lastNameIndex]?.trim() : undefined,
      role: roleIndex >= 0 ? values[roleIndex]?.trim() : 'member',
      department: departmentIndex >= 0 ? values[departmentIndex]?.trim() : undefined,
      groupIds: groupsIndex >= 0 ? values[groupsIndex]?.split(';').map(g => g.trim()).filter(Boolean) : undefined,
    });
  }
  
  return users;
}

// Parse a CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Valid roles
const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

/**
 * POST /api/admin/users/bulk-import
 * Import users from CSV data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'users:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const { csvContent, sendInvitations = true, defaultRole = 'member' } = body;
    
    if (!csvContent) {
      return NextResponse.json({ error: 'CSV content required' }, { status: 400 });
    }
    
    // Parse CSV
    let users: ImportUser[];
    try {
      users = parseCSV(csvContent);
    } catch (e) {
      return NextResponse.json({ 
        error: e instanceof Error ? e.message : 'Invalid CSV format' 
      }, { status: 400 });
    }
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'No valid users found in CSV' }, { status: 400 });
    }
    
    if (users.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 users per import' }, { status: 400 });
    }
    
    const results: ImportResult[] = [];
    const tenantId = session.user.tenantId;
    
    // Get existing users in tenant
    const existingEmails = new Set(
      (await prisma.user.findMany({
        where: { tenantId },
        select: { email: true },
      })).map(u => u.email.toLowerCase())
    );
    
    // Get pending invitations
    const pendingInvitations = new Set(
      (await prisma.teamInvitation.findMany({
        where: { tenantId, status: 'PENDING' },
        select: { email: true },
      })).map(i => i.email.toLowerCase())
    );
    
    for (const user of users) {
      // Validate email
      if (!isValidEmail(user.email)) {
        results.push({
          email: user.email,
          status: 'error',
          reason: 'Invalid email format',
        });
        continue;
      }
      
      // Check if already exists
      if (existingEmails.has(user.email)) {
        results.push({
          email: user.email,
          status: 'skipped',
          reason: 'User already exists',
        });
        continue;
      }
      
      // Check if invitation pending
      if (pendingInvitations.has(user.email)) {
        results.push({
          email: user.email,
          status: 'skipped',
          reason: 'Invitation already pending',
        });
        continue;
      }
      
      // Validate role
      const role = VALID_ROLES.includes(user.role || '') ? user.role : defaultRole;
      
      try {
        if (sendInvitations) {
          // Create invitation
          const token = randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          
          const invitation = await prisma.teamInvitation.create({
            data: {
              tenantId,
              email: user.email,
              role: role || 'member',
              token,
              invitedBy: session.user.id,
              expiresAt,
            },
          });
          
          // TODO: Send invitation email
          // await sendInvitationEmail(user.email, token, user.firstName);
          
          pendingInvitations.add(user.email);
          
          results.push({
            email: user.email,
            status: 'invited',
            userId: invitation.id,
          });
        } else {
          // Create user directly with temporary password
          const tempPassword = randomBytes(16).toString('hex');
          const passwordHash = await bcrypt.hash(tempPassword, 12);
          
          const newUser = await prisma.user.create({
            data: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              passwordHash,
              tenantId,
              role: role || 'member',
              status: 'PENDING',
              emailVerified: false,
            },
          });
          
          // Add to groups if specified
          if (user.groupIds && user.groupIds.length > 0) {
            await prisma.userGroupMember.createMany({
              data: user.groupIds.map(groupId => ({
                userId: newUser.id,
                groupId,
              })),
              skipDuplicates: true,
            });
          }
          
          existingEmails.add(user.email);
          
          results.push({
            email: user.email,
            status: 'created',
            userId: newUser.id,
          });
        }
      } catch (e) {
        console.error(`Failed to import user ${user.email}:`, e);
        results.push({
          email: user.email,
          status: 'error',
          reason: 'Database error',
        });
      }
    }
    
    // Audit log
    await auditLog({
      action: AuditAction.USERS_BULK_IMPORTED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      metadata: {
        totalAttempted: users.length,
        created: results.filter(r => r.status === 'created').length,
        invited: results.filter(r => r.status === 'invited').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
      },
      requestId: request.headers.get('x-request-id') || undefined,
    });
    
    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: users.length,
        created: results.filter(r => r.status === 'created').length,
        invited: results.filter(r => r.status === 'invited').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
      },
    });
  } catch (error) {
    console.error('[Bulk Import Error]:', error);
    return NextResponse.json({ error: 'Failed to import users' }, { status: 500 });
  }
}

/**
 * GET /api/admin/users/bulk-import
 * Get CSV template
 */
export async function GET() {
  const template = `email,firstName,lastName,role,department,groups
john.doe@example.com,John,Doe,member,Finance,
jane.smith@example.com,Jane,Smith,admin,Legal,
bob.wilson@example.com,Bob,Wilson,viewer,HR,group-id-1;group-id-2`;
  
  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="user-import-template.csv"',
    },
  });
}
