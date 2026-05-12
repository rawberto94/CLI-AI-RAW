import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIInsightsSummaryWidget, type AIInsight } from '../AIInsightsSummaryWidget';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileHover: _whileHover, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const insights: AIInsight[] = [
  {
    id: 'insight-1',
    category: 'risk',
    priority: 'high',
    title: 'Renewal risk detected',
    description: 'A key supplier contract is approaching an unfavorable renewal window.',
    confidence: 0.91,
    generatedAt: new Date('2026-05-08T00:00:00.000Z'),
  },
  {
    id: 'insight-2',
    category: 'opportunity',
    priority: 'medium',
    title: 'Savings opportunity',
    description: 'Several agreements could be consolidated for better pricing.',
    confidence: 0.84,
    generatedAt: new Date('2026-05-08T00:00:00.000Z'),
  },
  {
    id: 'insight-3',
    category: 'compliance',
    priority: 'low',
    title: 'Policy update available',
    description: 'A governance policy update affects standard fallback clauses.',
    confidence: 0.79,
    generatedAt: new Date('2026-05-08T00:00:00.000Z'),
  },
];

describe('AIInsightsSummaryWidget', () => {
  it('routes the footer CTA to the intelligence page', () => {
    render(<AIInsightsSummaryWidget insights={insights} maxInsights={2} showMetrics={false} />);

    const link = screen.getByRole('link', { name: /view all 3 insights/i });

    expect(link).toHaveAttribute('href', '/intelligence');
  });
});