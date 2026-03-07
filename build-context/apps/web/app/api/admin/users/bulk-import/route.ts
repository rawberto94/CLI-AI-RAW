/**
 * Bulk User Import API
 *
 * POST /api/admin/users/bulk-import - Import multiple users from CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { csvImportService } from 'data-orchestration/services';
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

/**
 * POST /api/admin/users/bulk-import
 * Import users from CSV data
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'users:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json();
  const { csvContent, sendInvitations = true, defaultRole = 'member' } = body;

  if (!csvContent) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'CSV content required', 400);
  }

  let users: ImportUser[];
  try {
    users = parseCSV(csvContent);
  } catch (e) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', e instanceof Error ? e.message : 'Invalid CSV format', 400);
  }

  if (users.length === 0) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No valid users found in CSV', 400);
  }

  if (users.length > 500) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Maximum 500 users per import', 400);
  }

  const results: ImportResult[] = [];
  const tenantId = ctx.tenantId;

  const existingEmails = new Set(
    (await prisma.user.findMany({
      where: { tenantId },
      select: { email: true },
    })).map(u => u.email.toLowerCase())
  );

  const pendingInvitations = new Set(
    (await prisma.teamInvitation.findMany({
      where: { tenantId, status: 'PENDING' },
      select: { email: true },
    })).map(i => i.email.toLowerCase())
  );

  for (const user of users) {
    if (!isValidEmail(user.email)) {
      results.push({ email: user.email, status: 'error', reason: 'Invalid email format' });
      continue;
    }

    if (existingEmails.has(user.email)) {
      results.push({ email: user.email, status: 'skipped', reason: 'User already exists' });
      continue;
    }

    if (pendingInvitations.has(user.email)) {
      results.push({ email: user.email, status: 'skipped', reason: 'Invitation already pending' });
      continue;
    }

    const role = VALID_ROLES.includes(user.role || '') ? user.role : defaultRole;

    try {
      if (sendInvitations) {
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const invitation = await prisma.teamInvitation.create({
          data: {
            tenantId,
            email: user.email,
            role: role || 'member',
            token,
            invitedBy: ctx.userId,
            expiresAt,
          },
        });

        try {
          const { sendEmail } = await import('@/lib/email/email-service');
          const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite?token=${token}`;
          await sendEmail({
            to: user.email,
            subject: "You've been invited to ConTigo",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome to ConTigo!</h2>
                <p>Hi${user.firstName ? ` ${user.firstName}` : ''},</p>
                <p>You've been invited to join our contract management platform.</p>
                <p><a href="${inviteUrl}" style="display: inline-block; background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>
                <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
              </div>
            `,
          });
        } catch (emailErr) {
          console.warn('Failed to send invitation email:', emailErr);
        }

        pendingInvitations.add(user.email);
        results.push({ email: user.email, status: 'invited', userId: invitation.id });
      } else {
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
        results.push({ email: user.email, status: 'created', userId: newUser.id });
      }
    } catch (e) {
      console.error(`Failed to import user ${user.email}:`, e);
      results.push({ email: user.email, status: 'error', reason: 'Database error' });
    }
  }

  await auditLog({
    action: AuditAction.USERS_BULK_IMPORTED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    metadata: {
      totalAttempted: users.length,
      created: results.filter(r => r.status === 'created').length,
      invited: results.filter(r => r.status === 'invited').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    },
    requestId: request.headers.get('x-request-id') || undefined,
  });

  return createSuccessResponse(ctx, {
    results,
    summary: {
      total: users.length,
      created: results.filter(r => r.status === 'created').length,
      invited: results.filter(r => r.status === 'invited').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    },
  });
});

/**
 * GET /api/admin/users/bulk-import
 * Get CSV template
 */
export const GET = withAuthApiHandler(async (_request, _ctx) => {
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
});
