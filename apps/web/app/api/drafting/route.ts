import { NextRequest, NextResponse } from 'next/server';

// Mock drafting data
const mockDocuments = [
  {
    id: 'doc1',
    name: 'Master Services Agreement',
    version: '3.2',
    status: 'draft',
    lastModified: '2024-03-14T10:30:00Z',
    collaborators: [
      { id: 'u1', name: 'Sarah Chen', isActive: true },
      { id: 'u2', name: 'Mike Johnson', isActive: true },
    ],
    wordCount: 4500,
    pageCount: 12,
    healthScore: 78,
  },
];

const mockSuggestions = [
  {
    id: 's1',
    type: 'risk',
    text: 'Liability cap missing',
    originalText: 'The Vendor shall be liable for all damages',
    suggestedText: 'The Vendor\'s liability shall be limited to the total fees paid',
    position: { start: 450, end: 495 },
    confidence: 0.92,
    source: 'Company Playbook',
  },
  {
    id: 's2',
    type: 'compliance',
    text: 'GDPR clause recommended',
    originalText: 'Data handling procedures',
    suggestedText: 'Data handling procedures in accordance with GDPR',
    position: { start: 890, end: 920 },
    confidence: 0.88,
    source: 'Regulatory Requirements',
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  if (documentId) {
    const document = mockDocuments.find(d => d.id === documentId);
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        document,
        suggestions: mockSuggestions,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      documents: mockDocuments,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, documentId, content, aiPrompt } = body;

    if (action === 'save') {
      return NextResponse.json({
        success: true,
        message: 'Document saved',
        data: {
          documentId: documentId || 'new-doc-1',
          savedAt: new Date().toISOString(),
          version: '3.3',
        },
      });
    }

    if (action === 'ai-assist') {
      // Mock AI assistance response
      return NextResponse.json({
        success: true,
        data: {
          generatedText: 'Based on your request, here is the suggested text...',
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
          suggestionId: body.suggestionId,
          appliedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'create-version') {
      return NextResponse.json({
        success: true,
        data: {
          versionId: `v-${Date.now()}`,
          version: '3.3',
          createdAt: new Date().toISOString(),
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
