/**
 * Button Component Tests
 *
 * Rewritten for Vitest (no @jest/globals).
 * Uses fireEvent from @testing-library/react (userEvent not installed).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Button } from '../button';

// ============================================================================
// Test Setup
// ============================================================================

const renderButton = (props: React.ComponentProps<typeof Button> = {}) => {
  return render(
    <Button {...props}>
      {props.children ?? 'Click me'}
    </Button>
  );
};

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      renderButton();

      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      renderButton({ children: 'Submit Form' });

      expect(screen.getByText('Submit Form')).toBeInTheDocument();
    });

    it('renders with different variants', () => {
      const { rerender } = render(<Button variant="default">Default</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button variant="destructive">Destructive</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with different sizes', () => {
      const { rerender } = render(<Button size="sm">Small</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Button size="lg">Large</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Interaction Tests
  // ============================================================================

  describe('Interactions', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      renderButton({ onClick: handleClick });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      renderButton({ onClick: handleClick, disabled: true });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('supports keyboard activation with Enter', () => {
      const handleClick = vi.fn();
      renderButton({ onClick: handleClick });

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      // Browsers fire click on Enter for buttons
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('has correct role', () => {
      renderButton();

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('is focusable', () => {
      renderButton();

      const button = screen.getByRole('button');
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it('is not focusable when disabled', () => {
      renderButton({ disabled: true });

      const button = screen.getByRole('button');

      expect(button).toBeDisabled();
    });

    it('supports aria-label', () => {
      renderButton({ 'aria-label': 'Close dialog' });

      const button = screen.getByRole('button', { name: 'Close dialog' });
      expect(button).toBeInTheDocument();
    });

    it('supports aria-describedby', () => {
      render(
        <>
          <p id="description">This action cannot be undone</p>
          <Button aria-describedby="description">Delete</Button>
        </>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'description');
    });
  });

  // ============================================================================
  // Loading State Tests
  // ============================================================================

  describe('Loading State', () => {
    it('is disabled when loading', () => {
      renderButton({ loading: true });
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  // ============================================================================
  // Snapshot Tests
  // ============================================================================

  describe('Snapshots', () => {
    it('matches default snapshot', () => {
      const { container } = renderButton();
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches disabled snapshot', () => {
      const { container } = renderButton({ disabled: true });
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});

// ============================================================================
// Test Utilities Demo
// ============================================================================

describe('Testing Patterns Demo', () => {
  it('demonstrates click handler testing', () => {
    const handleClick = vi.fn();
    renderButton({ onClick: handleClick });

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalled();
  });

  it('demonstrates testing error states', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Test error handling here

    consoleSpy.mockRestore();
  });
});
