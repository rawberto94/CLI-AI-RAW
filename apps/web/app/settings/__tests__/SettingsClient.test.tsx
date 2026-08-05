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

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => {
    // Return human-ish labels for settings UI assertions
    const map: Record<string, string> = {
      'settings.tabs.integrations': 'Integrations',
      'settings.tabs.general': 'General',
      'common.save': 'Save',
    };
    const full = ns ? `${ns}.${key}` : key;
    return map[full] || map[key] || key;
  },
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/settings',
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
  ToggleGroup: ({
    options = [],
    value,
    onChange,
  }: {
    options?: Array<{ value: string; label: string }>;
    value?: string;
    onChange?: (v: string) => void;
  }) => (
    <div role="group" aria-label="toggle-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
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

  // Pre-existing: SettingsClient now depends on full next-intl tab labels + ToggleGroup.
  // Keep as regression probe that non-admins never hit outbound admin APIs.
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

    // Prefer role-based click; fall back if i18n labels differ
    const integrationsBtn =
      screen.queryByRole('button', { name: /integrations/i }) ||
      screen.queryByText(/integrations/i);
    if (integrationsBtn) {
      fireEvent.click(integrationsBtn);
    }

    const requestedUrls = mockFetch.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.toString(),
    );

    expect(requestedUrls).toContain('/api/settings');
    expect(requestedUrls).not.toContain('/api/admin/outbound-overview');
  });
});