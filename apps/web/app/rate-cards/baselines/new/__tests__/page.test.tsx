import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewBaselinePage from '../page';

const { mockPush, mockBaselineEntryForm } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockBaselineEntryForm: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/rate-cards/RateCardBreadcrumbs', () => ({
  RateCardBreadcrumbs: () => <div>rate-card-breadcrumbs</div>,
}));

vi.mock('@/components/rate-cards/BaselineEntryForm', () => ({
  BaselineEntryForm: (props: { onSuccess?: () => void; onCancel?: () => void }) => {
    mockBaselineEntryForm(props);

    return (
      <div>
        <button type="button" onClick={props.onSuccess}>success</button>
        <button type="button" onClick={props.onCancel}>cancel</button>
      </div>
    );
  },
}));

describe('NewBaselinePage', () => {
  it('renders the baseline form and returns to baselines after success', () => {
    render(<NewBaselinePage />);

    expect(screen.getByText('Add Baseline')).toBeInTheDocument();
    expect(screen.getByText('rate-card-breadcrumbs')).toBeInTheDocument();
    expect(mockBaselineEntryForm).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'success' }));

    expect(mockPush).toHaveBeenCalledWith('/rate-cards/baselines');
  });
});