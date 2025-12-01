/**
 * Tests for useTabs hook
 * @see /hooks/useTabs.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabs } from '../../hooks/useTabs';

describe('useTabs', () => {
  describe('initialization', () => {
    it('should initialize with default value', () => {
      const { result } = renderHook(() => 
        useTabs({ defaultValue: 'tab1', values: ['tab1', 'tab2', 'tab3'] })
      );

      expect(result.current.value).toBe('tab1');
    });
  });

  describe('navigation', () => {
    it('should set value', () => {
      const { result } = renderHook(() => 
        useTabs({ defaultValue: 'tab1', values: ['tab1', 'tab2', 'tab3'] })
      );

      act(() => {
        result.current.setValue('tab2');
      });

      expect(result.current.value).toBe('tab2');
    });

    it('should check if tab is active', () => {
      const { result } = renderHook(() => 
        useTabs({ defaultValue: 'tab1', values: ['tab1', 'tab2', 'tab3'] })
      );

      expect(result.current.isActive('tab1')).toBe(true);
      expect(result.current.isActive('tab2')).toBe(false);
    });

    it('should navigate to next tab', () => {
      const { result } = renderHook(() => 
        useTabs({ defaultValue: 'tab1', values: ['tab1', 'tab2', 'tab3'] })
      );

      act(() => {
        result.current.next();
      });

      expect(result.current.value).toBe('tab2');
    });

    it('should navigate to previous tab', () => {
      const { result } = renderHook(() => 
        useTabs({ defaultValue: 'tab2', values: ['tab1', 'tab2', 'tab3'] })
      );

      act(() => {
        result.current.previous();
      });

      expect(result.current.value).toBe('tab1');
    });

    it('should reset to default value', () => {
      const { result } = renderHook(() => 
        useTabs({ defaultValue: 'tab1', values: ['tab1', 'tab2', 'tab3'] })
      );

      act(() => {
        result.current.setValue('tab3');
      });

      expect(result.current.value).toBe('tab3');

      act(() => {
        result.current.reset();
      });

      expect(result.current.value).toBe('tab1');
    });
  });

  describe('tabsProps', () => {
    it('should return correct props', () => {
      const { result } = renderHook(() => 
        useTabs({ defaultValue: 'tab1', values: ['tab1', 'tab2', 'tab3'] })
      );

      expect(result.current.tabsProps.value).toBe('tab1');
      expect(typeof result.current.tabsProps.onValueChange).toBe('function');
    });

    it('should update value via onValueChange', () => {
      const { result } = renderHook(() => 
        useTabs({ defaultValue: 'tab1', values: ['tab1', 'tab2', 'tab3'] })
      );

      act(() => {
        result.current.tabsProps.onValueChange('tab2');
      });

      expect(result.current.value).toBe('tab2');
    });
  });

  describe('onChange callback', () => {
    it('should call onChange when value changes', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => 
        useTabs({ 
          defaultValue: 'tab1', 
          values: ['tab1', 'tab2', 'tab3'],
          onChange
        })
      );

      act(() => {
        result.current.setValue('tab2');
      });

      expect(onChange).toHaveBeenCalledWith('tab2');
    });
  });
});
