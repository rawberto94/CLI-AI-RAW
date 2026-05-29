import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockConversationFindMany,
  mockConversationCount,
  mockConversationCreate,
  mockConversationFindFirst,
  mockConversationUpdate,
  mockMessageCreate,
} = vi.hoisted(() => ({
  mockConversationFindMany: vi.fn(),
  mockConversationCount: vi.fn(),
  mockConversationCreate: vi.fn(),
  mockConversationFindFirst: vi.fn(),
  mockConversationUpdate: vi.fn(),
  mockMessageCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatConversation: {
      findMany: mockConversationFindMany,
      count: mockConversationCount,
      create: mockConversationCreate,
      findFirst: mockConversationFindFirst,
      update: mockConversationUpdate,
    },
    chatMessage: {
      create: mockMessageCreate,
    },
  },
}));

import { GET as listConversations, POST as createConversation } from '../route';
import { POST as createMessage } from '../[id]/messages/route';

function request(path: string, init: RequestInit = {}): NextRequest {
  const headers = new Headers(init.headers);
  headers.set('x-user-id', 'user-1');
  headers.set('x-tenant-id', 'tenant-1');
  headers.set('x-user-role', 'member');

  return new NextRequest(`http://localhost:3000${path}`, {
    ...init,
    headers: Object.fromEntries(headers.entries()),
  });
}

describe('chat conversation persistence API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationCount.mockResolvedValue(0);
    mockConversationUpdate.mockResolvedValue({});
  });

  it('returns conversation lists without double data nesting', async () => {
    mockConversationFindMany.mockResolvedValue([
      {
        id: 'conversation-1',
        title: 'Renewal question',
        context: null,
        contextType: 'global',
        messageCount: 2,
        lastMessageAt: new Date('2026-05-29T10:00:00.000Z'),
        messages: [{ id: 'message-1', role: 'assistant', content: 'Done', createdAt: new Date('2026-05-29T10:00:00.000Z') }],
        isPinned: false,
        isArchived: false,
        createdAt: new Date('2026-05-29T09:00:00.000Z'),
        updatedAt: new Date('2026-05-29T10:00:00.000Z'),
      },
    ]);
    mockConversationCount.mockResolvedValue(1);

    const response = await listConversations(request('/api/chat/conversations'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.conversations).toHaveLength(1);
    expect(body.data.data).toBeUndefined();
  });

  it('returns created conversations directly for the persistence hook', async () => {
    mockConversationCreate.mockResolvedValue({ id: 'conversation-1', title: 'New Conversation' });

    const response = await createConversation(request('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Conversation', contextType: 'global' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe('conversation-1');
    expect(body.data.conversation).toBeUndefined();
  });

  it('persists structured RAG source metadata on assistant messages', async () => {
    const ragSources = [
      {
        contractId: 'contract-1',
        contractName: 'Master Services Agreement',
        score: 0.91,
        snippet: 'The supplier must provide 90 days notice.',
      },
    ];
    mockConversationFindFirst.mockResolvedValue({ id: 'conversation-1', tenantId: 'tenant-1', userId: 'user-1' });
    mockMessageCreate.mockResolvedValue({ id: 'message-1', role: 'assistant', content: 'Answer', sources: ragSources });

    const response = await createMessage(request('/api/chat/conversations/conversation-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'assistant',
        content: 'Answer',
        metadata: {
          confidence: 0.87,
          ragSources,
        },
      }),
    }), { params: Promise.resolve({ id: 'conversation-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe('message-1');
    expect(mockMessageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        confidence: 0.87,
        sources: ragSources,
      }),
    }));
  });
});