import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsClient from '../SettingsClient';

const { mockFetch, successToast, errorToast } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: successToast,
    error: errorToast,
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _initial, animate: _animate, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, initial: _initial, animate: _animate, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button type="button" {...props}>{children}</button>
    ),
  },
}));

vi.mock('@/components/navigation', () => ({
  PageBreadcrumb: () => <nav aria-label="Breadcrumb">Breadcrumb</nav>,
}));

vi.mock('@/components/alert', () => ({
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/toggle', () => ({
  Toggle: ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <button type="button" aria-pressed={checked} onClick={() => onChange(!checked)}>
      Toggle
    </button>
  ),
}));

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

describe('SettingsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('does not fetch outbound admin overview for non-admin users', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/settings') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              user: {
                name: 'Member User',
                email: 'member@example.com',
                role: 'member',
                avatar: null,
              },
              settings: {
                system: {},
                notifications: {},
                security: {},
                display: {},
                processing: {},
              },
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<SettingsClient />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Integrations' }));

    expect(
      await screen.findByText(
        'Webhook endpoints, delivery recovery, durable event replay, and API token management are limited to organization admins and owners.',
      ),
    ).toBeInTheDocument();

    const requestedUrls = mockFetch.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.toString(),
    );

    expect(requestedUrls).toContain('/api/settings');
    expect(requestedUrls).not.toContain('/api/admin/outbound-overview');
  });
});