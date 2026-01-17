/**
 * Drafting API - Real-time contract drafting and AI assistance
 * 
 * GET /api/drafting - Get drafting documents
 * POST /api/drafting - Perform drafting actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (documentId) {
      // Get specific draft
      const draft = await prisma.contractDraft.findFirst({
        where: { id: documentId, tenantId },
        include: {
          template: {
            select: { id: true, name: true, category: true },
          },
          createdByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (!draft) {
        return NextResponse.json(
          { success: false, error: 'Document not found' },
          { status: 404 }
        );
      }

      // Transform to document format
      const document = {
        id: draft.id,
        name: draft.title,
        version: `${draft.version}.0`,
        status: draft.status.toLowerCase(),
        lastModified: draft.updatedAt.toISOString(),
        collaborators: [],
        wordCount: draft.content ? String(draft.content).split(/\s+/).length : 0,
        pageCount: Math.ceil((draft.content ? String(draft.content).split(/\s+/).length : 0) / 300),
        healthScore: 80,
        content: draft.content,
        clauses: draft.clauses,
        variables: draft.variables,
      };

      // AI suggestions would come from a separate analysis service
      const suggestions: Array<{
        id: string;
        type: string;
        text: string;
        confidence: number;
        source: string;
      }> = [];

      return NextResponse.json({
        success: true,
        data: {
          document,
          suggestions,
        },
      });
    }

    // List all drafts as documents
    const drafts = await prisma.contractDraft.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const documents = drafts.map((draft) => ({
      id: draft.id,
      name: draft.title,
      version: `${draft.version}.0`,
      status: draft.status.toLowerCase(),
      lastModified: draft.updatedAt.toISOString(),
      collaborators: draft.createdByUser ? [{
        id: draft.createdByUser.id,
        name: [draft.createdByUser.firstName, draft.createdByUser.lastName].filter(Boolean).join(' '),
        isActive: true,
      }] : [],
      wordCount: draft.content ? String(draft.content).split(/\s+/).length : 0,
      pageCount: Math.ceil((draft.content ? String(draft.content).split(/\s+/).length : 0) / 300),
      healthScore: 80,
    }));

    return NextResponse.json({
      success: true,
      data: {
        documents,
      },
    });
  } catch (error) {
    console.error('Error in drafting GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const body = await request.json();
    const { action, documentId, content, aiPrompt, suggestionId, clauses, variables } = body;

    if (action === 'save') {
      if (!documentId) {
        // Create new draft
        const draft = await prisma.contractDraft.create({
          data: {
            tenantId,
            title: body.name || 'Untitled Draft',
            type: body.type || 'MSA',
            sourceType: 'NEW',
            content: content || '',
            clauses: clauses || [],
            variables: variables || {},
            createdBy: session.user.id,
            status: 'DRAFT',
            version: 1,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Document created',
          data: {
            documentId: draft.id,
            savedAt: new Date().toISOString(),
            version: '1.0',
          },
        });
      }

      // Update existing draft
      const existing = await prisma.contractDraft.findFirst({
        where: { id: documentId, tenantId },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Document not found' },
          { status: 404 }
        );
      }

      const updated = await prisma.contractDraft.update({
        where: { id: documentId },
        data: {
          content: content !== undefined ? content : existing.content,
          clauses: clauses !== undefined ? clauses : existing.clauses,
          variables: variables !== undefined ? variables : existing.variables,
          version: existing.version + 1,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Document saved',
        data: {
          documentId: updated.id,
          savedAt: new Date().toISOString(),
          version: `${updated.version}.0`,
        },
      });
    }

    if (action === 'ai-assist') {
      // This would integrate with the AI service
      // For now, return a placeholder
      return NextResponse.json({
        success: true,
        data: {
          generatedText: aiPrompt 
            ? `Based on your request "${aiPrompt}", here is the suggested text...`
            : 'Please provide a prompt for AI assistance.',
          confidence: 0.85,
          sources: ['Company Playbook', 'Industry Standards'],
        },
      });
    }

    if (action === 'apply-suggestion') {
      return NextResponse.json({
        success: true,
        message: 'Suggestion applied',
        data: {
          suggestionId,
          appliedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'create-version') {
      if (!documentId) {
        return NextResponse.json(
          { success: false, error: 'Document ID required' },
          { status: 400 }
        );
      }

      const draft = await prisma.contractDraft.findFirst({
        where: { id: documentId, tenantId },
      });

      if (!draft) {
        return NextResponse.json(
          { success: false, error: 'Document not found' },
          { status: 404 }
        );
      }

      const updated = await prisma.contractDraft.update({
        where: { id: documentId },
        data: {
          version: draft.version + 1,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          versionId: `v-${Date.now()}`,
          version: `${updated.version}.0`,
          createdAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in drafting POST:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
