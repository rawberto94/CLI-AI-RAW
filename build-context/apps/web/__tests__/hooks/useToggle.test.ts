/**
 * Tests for useToggle hook
 * @see /hooks/useToggle.ts
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToggle, useDisclosure } from '../../hooks/useToggle';

describe('useToggle', () => {
  describe('basic toggle', () => {
    it('should initialize with false by default', () => {
      const { result } = renderHook(() => useToggle());
      expect(result.current.value).toBe(false);
    });

    it('should initialize with provided value', () => {
      const { result } = renderHook(() => useToggle(true));
      expect(result.current.value).toBe(true);
    });

    it('should toggle value', () => {
      const { result } = renderHook(() => useToggle(false));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.value).toBe(true);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.value).toBe(false);
    });

    it('should set true', () => {
      const { result } = renderHook(() => useToggle(false));

      act(() => {
        result.current.setTrue();
      });

      expect(result.current.value).toBe(true);
    });

    it('should set false', () => {
      const { result } = renderHook(() => useToggle(true));

      act(() => {
        result.current.setFalse();
      });

      expect(result.current.value).toBe(false);
    });

    it('should set value directly', () => {
      const { result } = renderHook(() => useToggle(false));

      act(() => {
        result.current.setValue(true);
      });

      expect(result.current.value).toBe(true);
    });
  });
});

describe('useDisclosure', () => {
  it('should initialize as closed by default', () => {
    const { result } = renderHook(() => useDisclosure());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.value).toBe(false);
  });

  it('should open when onOpen is called', () => {
    const { result } = renderHook(() => useDisclosure());

    act(() => {
      result.current.onOpen();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('should close when onClose is called', () => {
    const { result } = renderHook(() => useDisclosure(true));

    act(() => {
      result.current.onClose();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('should toggle when onToggle is called', () => {
    const { result } = renderHook(() => useDisclosure());

    act(() => {
      result.current.onToggle();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.onToggle();
    });

    expect(result.current.isOpen).toBe(false);
  });
});
