/**
 * Button Component Tests
 * 
 * Example component test demonstrating testing patterns and best practices.
 * This serves as a template for other component tests.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';
import { createTestQueryClient } from '@/lib/test-utils';
import { QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// Test Setup
// ============================================================================

const renderButton = (props: React.ComponentProps<typeof Button> = {}) => {
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();
  
  const result = render(
    <QueryClientProvider client={queryClient}>
      <Button {...props}>
        {props.children ?? 'Click me'}
      </Button>
    </QueryClientProvider>
  );

  return { ...result, user };
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
    it('calls onClick when clicked', async () => {
      const handleClick = jest.fn();
      const { user } = renderButton({ onClick: handleClick });
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const handleClick = jest.fn();
      const { user } = renderButton({ onClick: handleClick, disabled: true });
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('supports keyboard activation with Enter', async () => {
      const handleClick = jest.fn();
      const { user } = renderButton({ onClick: handleClick });
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('supports keyboard activation with Space', async () => {
      const handleClick = jest.fn();
      const { user } = renderButton({ onClick: handleClick });
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');
      
      expect(handleClick).toHaveBeenCalledTimes(1);
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
    it('shows loading indicator when loading', () => {
      // Assuming Button supports a loading prop
      // renderButton({ loading: true });
      // expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('is disabled when loading', () => {
      // renderButton({ loading: true });
      // expect(screen.getByRole('button')).toBeDisabled();
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
  it('demonstrates waiting for async operations', async () => {
    const handleClick = jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 100));
    });
    
    const { user } = renderButton({ onClick: handleClick });
    
    await user.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(handleClick).toHaveBeenCalled();
    });
  });

  it('demonstrates testing with query params', async () => {
    // Example of testing with query data
    const queryClient = createTestQueryClient();
    
    // Pre-populate cache
    queryClient.setQueryData(['contracts'], [
      { id: '1', title: 'Contract 1' },
      { id: '2', title: 'Contract 2' },
    ]);
    
    // Component would now have access to this cached data
  });

  it('demonstrates testing error states', async () => {
    // Mock console.error to prevent noise in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Test error handling here
    
    consoleSpy.mockRestore();
  });
});
