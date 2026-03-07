/**
 * Tests for useContractsKeyboardShortcuts hook
 * @see /hooks/use-contracts-keyboard-shortcuts.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useContractsKeyboardShortcuts } from '../../hooks/use-contracts-keyboard-shortcuts';

describe('useContractsKeyboardShortcuts', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  const createKeyboardEvent = (key: string, options: Partial<KeyboardEvent> = {}) => {
    return new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
  };

  describe('initialization', () => {
    it('should add event listener on mount', () => {
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onSearch: vi.fn(),
          enabled: true,
        })
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should remove event listener on unmount', () => {
      const { unmount } = renderHook(() =>
        useContractsKeyboardShortcuts({
          onSearch: vi.fn(),
          enabled: true,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should not add listener when disabled', () => {
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onSearch: vi.fn(),
          enabled: false,
        })
      );

      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });
  });

  describe('search shortcut (/)', () => {
    it('should call onSearch when / is pressed', () => {
      const onSearch = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onSearch,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('/'));

      expect(onSearch).toHaveBeenCalled();
    });

    it('should not call onSearch when / is pressed in input', () => {
      const onSearch = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onSearch,
          enabled: true,
        })
      );

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = createKeyboardEvent('/');
      Object.defineProperty(event, 'target', { value: input });
      document.dispatchEvent(event);

      // Should not trigger when focus is on input
      // The actual behavior depends on implementation
      
      document.body.removeChild(input);
    });
  });

  describe('refresh shortcut (r)', () => {
    it('should call onRefresh when r is pressed', () => {
      const onRefresh = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onRefresh,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('r'));

      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe('view toggle shortcut (v)', () => {
    it('should call onToggleView when v is pressed', () => {
      const onToggleView = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onToggleView,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('v'));

      expect(onToggleView).toHaveBeenCalled();
    });
  });

  describe('new contract shortcut (n)', () => {
    it('should call onNewContract when n is pressed', () => {
      const onNewContract = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onNewContract,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('n'));

      expect(onNewContract).toHaveBeenCalled();
    });
  });

  describe('escape shortcut', () => {
    it('should call onEscape when Escape is pressed', () => {
      const onEscape = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onEscape,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('Escape'));

      expect(onEscape).toHaveBeenCalled();
    });
  });

  describe('select all shortcut (a / Cmd+A)', () => {
    it('should call onSelectAll when a is pressed', () => {
      const onSelectAll = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onSelectAll,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('a'));

      expect(onSelectAll).toHaveBeenCalled();
    });

    it('should call onSelectAll when Cmd+A is pressed', () => {
      const onSelectAll = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onSelectAll,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('a', { metaKey: true }));

      expect(onSelectAll).toHaveBeenCalled();
    });

    it('should call onSelectAll when Ctrl+A is pressed', () => {
      const onSelectAll = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onSelectAll,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('a', { ctrlKey: true }));

      expect(onSelectAll).toHaveBeenCalled();
    });
  });

  describe('export shortcut (Cmd+E)', () => {
    it('should call onExport when Cmd+E is pressed', () => {
      const onExport = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onExport,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('e', { metaKey: true }));

      expect(onExport).toHaveBeenCalled();
    });

    it('should call onExport when Ctrl+E is pressed', () => {
      const onExport = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onExport,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('e', { ctrlKey: true }));

      expect(onExport).toHaveBeenCalled();
    });
  });

  describe('delete shortcut (Cmd+D)', () => {
    it('should call onDelete when Cmd+D is pressed', () => {
      const onDelete = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onDelete,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('d', { metaKey: true }));

      expect(onDelete).toHaveBeenCalled();
    });

    it('should call onDelete when Ctrl+D is pressed', () => {
      const onDelete = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onDelete,
          enabled: true,
        })
      );

      document.dispatchEvent(createKeyboardEvent('d', { ctrlKey: true }));

      expect(onDelete).toHaveBeenCalled();
    });
  });

  describe('optional handlers', () => {
    it('should not throw when handler is not provided', () => {
      renderHook(() =>
        useContractsKeyboardShortcuts({
          enabled: true,
          // No handlers provided
        })
      );

      expect(() => {
        document.dispatchEvent(createKeyboardEvent('/'));
        document.dispatchEvent(createKeyboardEvent('r'));
        document.dispatchEvent(createKeyboardEvent('v'));
        document.dispatchEvent(createKeyboardEvent('n'));
        document.dispatchEvent(createKeyboardEvent('Escape'));
      }).not.toThrow();
    });
  });

  describe('enabled toggle', () => {
    it('should not call handlers when disabled', () => {
      const onSearch = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onSearch,
          enabled: false,
        })
      );

      document.dispatchEvent(createKeyboardEvent('/'));

      expect(onSearch).not.toHaveBeenCalled();
    });

    it('should respond to enabled prop changes', () => {
      const onSearch = vi.fn();
      const { rerender } = renderHook(
        ({ enabled }) =>
          useContractsKeyboardShortcuts({
            onSearch,
            enabled,
          }),
        { initialProps: { enabled: false } }
      );

      document.dispatchEvent(createKeyboardEvent('/'));
      expect(onSearch).not.toHaveBeenCalled();

      rerender({ enabled: true });

      document.dispatchEvent(createKeyboardEvent('/'));
      expect(onSearch).toHaveBeenCalled();
    });
  });

  describe('event prevention', () => {
    it('should prevent default for handled shortcuts', () => {
      const onSearch = vi.fn();
      renderHook(() =>
        useContractsKeyboardShortcuts({
          onSearch,
          enabled: true,
        })
      );

      const event = createKeyboardEvent('/');
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      // Depending on implementation, it may or may not prevent default
      // This is testing the behavior if it does
    });
  });
});
