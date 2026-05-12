import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfessionalDashboard } from '../ProfessionalDashboard';

const {
  mockFetch,
  mockPush,
  mockUseSession,
} = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockPush: vi.fn(),
  mockUseSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@/hooks/use-queries', () => ({
  useDashboardStats: () => ({
    data: {
      success: true,
      data: {
        overview: {
          totalContracts: 0,
          activeContracts: 0,
          portfolioValue: 0,
          recentlyAdded: 0,
        },
        health: {
          averageScore: 80,
          trends: { improving: 0, declining: 0 },
          byAlertLevel: {},
        },
        breakdown: {
          byStatus: [],
          byType: [],
          byMonth: [],
        },
        trends: {
          contracts: 0,
          value: 0,
        },
      },
    },
    isLoading: false,
  }),
  usePendingApprovals: () => ({ data: { data: { items: [] } }, isLoading: false }),
  useContractExpirations: () => ({ data: { data: { items: [] } }, isLoading: false }),
  useContractHealthScores: () => ({ data: { data: { stats: { averageScore: 80 } } }, isLoading: false }),
  useCrossModuleInvalidation: () => ({}),
}));

vi.mock('@/components/workflows/DeadlineAlerts', () => ({
  DeadlineAlertBanner: () => <div>deadline-alert-banner</div>,
  useDeadlineAlerts: () => ({ alerts: [] }),
}));

vi.mock('@/components/charts/lazy-charts', () => {
  const Wrapper = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return {
    LazyLineChart: Wrapper,
    LazyLine: Wrapper,
    LazyAreaChart: Wrapper,
    LazyArea: Wrapper,
    LazyBarChart: Wrapper,
    LazyBar: Wrapper,
    LazyPieChart: Wrapper,
    LazyPie: Wrapper,
    LazyCell: Wrapper,
    LazyXAxis: Wrapper,
    LazyYAxis: Wrapper,
    LazyCartesianGrid: Wrapper,
    LazyTooltip: Wrapper,
    LazyLegend: Wrapper,
    LazyResponsiveContainer: Wrapper,
  };
});

vi.mock('../RecentActivityWidget', () => ({
  RecentActivityWidget: () => <div>recent-activity-widget</div>,
}));

vi.mock('../FavoriteContractsWidget', () => ({
  FavoriteContractsWidget: () => <div>favorite-contracts-widget</div>,
}));

vi.mock('../UpcomingRenewalsWidget', () => ({
  UpcomingRenewalsWidget: () => <div>upcoming-renewals-widget</div>,
}));

vi.mock('../AIInsightsSummaryWidget', () => ({
  AIInsightsSummaryWidget: () => <div>ai-insights-summary-widget</div>,
}));

vi.mock('../ContractNotificationsWidget', () => ({
  ContractNotificationsWidget: () => <div>contract-notifications-widget</div>,
}));

vi.mock('../KeyboardShortcutsPanel', () => ({
  KeyboardShortcutsPanel: () => <div>keyboard-shortcuts-panel</div>,
}));

vi.mock('../SavingsTrackerWidget', () => ({
  SavingsTrackerWidget: () => <div>savings-tracker-widget</div>,
}));

vi.mock('../TeamActivityWidget', () => ({
  TeamActivityWidget: ({ onViewAll }: { onViewAll?: () => void }) => (
    <div>{onViewAll ? 'team-view-all-enabled' : 'team-view-all-disabled'}</div>
  ),
}));

vi.mock('../IntegrationStatusWidget', () => ({
  IntegrationStatusWidget: ({ onViewAll, onSettings }: { onViewAll?: () => void; onSettings?: (integrationId: string) => void }) => (
    <div>
      <div>{onViewAll ? 'view-all-enabled' : 'view-all-disabled'}</div>
      <div>{onSettings ? 'settings-enabled' : 'settings-disabled'}</div>
      <button type="button" onClick={() => onViewAll?.()}>
        trigger-view-all
      </button>
      <button type="button" onClick={() => onSettings?.('integration-1')}>
        trigger-settings
      </button>
    </div>
  ),
}));

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

describe('ProfessionalDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  it('hides integration management actions for non-admin users', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          role: 'member',
        },
      },
    });

    render(<ProfessionalDashboard />);

    expect(screen.getByText('team-view-all-disabled')).toBeInTheDocument();
    expect(screen.getByText('view-all-disabled')).toBeInTheDocument();
    expect(screen.getByText('settings-disabled')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'trigger-view-all' }));
    fireEvent.click(screen.getByRole('button', { name: 'trigger-settings' }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('routes admins to the admin integrations page', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          role: 'admin',
        },
      },
    });

    render(<ProfessionalDashboard />);

    expect(screen.getByText('team-view-all-disabled')).toBeInTheDocument();
    expect(screen.getByText('view-all-enabled')).toBeInTheDocument();
    expect(screen.getByText('settings-enabled')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'trigger-view-all' }));
    fireEvent.click(screen.getByRole('button', { name: 'trigger-settings' }));

    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenNthCalledWith(1, '/admin/integrations');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/admin/integrations');
  });
});