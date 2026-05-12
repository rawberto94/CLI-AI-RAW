import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '../CommandPalette';

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    mockPush.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('routes built-in help, profile, and sign-out commands to canonical pages', () => {
    render(<CommandPalette isOpen onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Help & Support/i }));
    fireEvent.click(screen.getByRole('button', { name: /Go to Profile/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sign Out/i }));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/self-service/help');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/settings/profile');
    expect(mockPush).toHaveBeenNthCalledWith(3, '/auth/signout');
  });
});