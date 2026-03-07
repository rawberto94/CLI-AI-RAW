/**
 * ContractAIAnalyst Component Tests
 *
 * Basic rendering and interaction tests for the contract-specific AI Q&A widget
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ContractAIAnalyst, type ContractContext } from '../ContractAIAnalyst';

// ============================================================================
// Mocks
// ============================================================================

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial: _initial, animate: _animate, exit: _exit, ...rest } = props as {
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
      } & Record<string, unknown>;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock lucide-react icons to be identifiable in tests
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="send-icon" {...props} />,
  };
});

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// ============================================================================
// Test Setup
// ============================================================================

const defaultContract: ContractContext = {
  id: 'test-contract-123',
  name: 'IT Services Agreement',
  supplierName: 'Tech Corp',
  contractType: 'IT Services',
  totalValue: 100000,
  startDate: '2024-01-01',
  endDate: '2025-12-31',
  status: 'Active',
};

interface RenderOptions {
  contract?: Partial<ContractContext>;
  defaultExpanded?: boolean;
}

const renderComponent = ({
  contract = {},
  defaultExpanded = true,
}: RenderOptions = {}) => {
  const queryClient = createTestQueryClient();
  const props = {
    contract: { ...defaultContract, ...contract },
    defaultExpanded,
  };

  const result = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ContractAIAnalyst {...props} />
      </TooltipProvider>
    </QueryClientProvider>
  );

  return result;
};

// Helper to create successful API response
const createSuccessResponse = (data: object) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

// Helper to create error API response
const createErrorResponse = (status: number, message: string) => ({
  ok: false,
  status,
  json: () => Promise.resolve({ error: message }),
});

// Helper to find the send button
const findSendButton = (): HTMLElement | null => {
  // Look for button containing the send icon
  const sendIcon = screen.queryByTestId('send-icon');
  if (sendIcon) {
    const button = sendIcon.closest('button');
    if (button) return button;
  }

  // Fallback: find all buttons and look for one that might be the send button
  const buttons = screen.getAllByRole('button');
  for (const btn of buttons) {
    // The send button should be near the input area and not disabled by default
    if (btn.classList.contains('bg-violet-600') || btn.classList.contains('hover:bg-violet-700')) {
      return btn;
    }
  }

  // Final fallback: return the last button (usually the submit)
  return buttons[buttons.length - 1] || null;
};

// ============================================================================
// Tests
// ============================================================================

describe('ContractAIAnalyst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Rendering', () => {
    it('renders the component header', () => {
      renderComponent();
      expect(screen.getByText('AI Contract Analyst')).toBeInTheDocument();
    });

    it('renders in collapsed state by default', () => {
      renderComponent({ defaultExpanded: false });
      expect(screen.getByText('AI Contract Analyst')).toBeInTheDocument();
    });

    it('shows contract name when expanded', () => {
      renderComponent({
        contract: { name: 'Test Contract Name' },
        defaultExpanded: true,
      });
      // The contract name appears in "Analyzing: {contract.name}"
      expect(screen.getByText(/Test Contract Name/)).toBeInTheDocument();
    });
  });

  describe('Query Input', () => {
    it('renders textarea input when expanded', () => {
      renderComponent({ defaultExpanded: true });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('allows typing in the textarea', () => {
      renderComponent({ defaultExpanded: true });
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'What are the payment terms?' } });
      expect(textarea).toHaveValue('What are the payment terms?');
    });
  });

  describe('Form Submission', () => {
    it('calls API when form is submitted', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          answer: 'The contract requires 30-day payment terms.',
          confidence: 0.92,
          sources: [],
          suggestions: [],
        })
      );

      renderComponent();

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'What are the payment terms?' } });

      const sendButton = findSendButton();
      expect(sendButton).not.toBeNull();

      await act(async () => {
        fireEvent.click(sendButton!);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/ai/contract-analyst',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('displays AI response after submission', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          answer: 'The liability is limited to $500,000.',
          confidence: 0.88,
          sources: [],
          suggestions: [],
        })
      );

      renderComponent();

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'What is the liability cap?' } });

      const sendButton = findSendButton();
      expect(sendButton).not.toBeNull();

      await act(async () => {
        fireEvent.click(sendButton!);
      });

      await waitFor(
        () => {
          expect(screen.getByText(/liability.*limited.*\$500,000/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, 'Server error'));

      renderComponent();

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test question' } });

      const sendButton = findSendButton();
      expect(sendButton).not.toBeNull();

      await act(async () => {
        fireEvent.click(sendButton!);
      });

      await waitFor(
        () => {
          // Should show error message
          expect(screen.getByText(/error|failed|unable/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test question' } });

      const sendButton = findSendButton();
      expect(sendButton).not.toBeNull();

      await act(async () => {
        fireEvent.click(sendButton!);
      });

      await waitFor(
        () => {
          expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Conversation', () => {
    it('displays user message after submission', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          answer: 'Answer to the question.',
          confidence: 0.9,
          sources: [],
          suggestions: [],
        })
      );

      renderComponent();

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'What are the key obligations?' } });

      const sendButton = findSendButton();
      expect(sendButton).not.toBeNull();

      await act(async () => {
        fireEvent.click(sendButton!);
      });

      await waitFor(
        () => {
          expect(screen.getByText(/What are the key obligations/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('API Request', () => {
    it('sends contract ID in request body', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          answer: 'Response.',
          confidence: 0.9,
          sources: [],
          suggestions: [],
        })
      );

      renderComponent({
        contract: { id: 'contract-xyz-789' },
      });

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test question' } });

      const sendButton = findSendButton();
      expect(sendButton).not.toBeNull();

      await act(async () => {
        fireEvent.click(sendButton!);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toBe('/api/ai/contract-analyst');
        const body = JSON.parse(options.body);
        expect(body.contractId).toBe('contract-xyz-789');
      });
    });
  });
});
