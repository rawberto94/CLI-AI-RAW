/**
 * Tests for useSelection hook
 * @see /hooks/useSelection.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection, useCheckboxGroup, useRadioGroup } from '../../hooks/useSelection';

describe('useSelection', () => {
  const items = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
    { id: 4, name: 'Item 4' },
  ];

  describe('initialization', () => {
    it('should initialize with empty selection', () => {
      const { result } = renderHook(() => useSelection<typeof items[0]>());

      expect(result.current.selected).toEqual([]);
      expect(result.current.count).toBe(0);
      expect(result.current.hasSelection).toBe(false);
    });

    it('should initialize with initial selection', () => {
      const { result } = renderHook(() =>
        useSelection({ initialSelected: [items[0]!] })
      );

      expect(result.current.selected).toEqual([items[0]]);
      expect(result.current.count).toBe(1);
      expect(result.current.hasSelection).toBe(true);
    });
  });

  describe('select/deselect', () => {
    it('should select an item', () => {
      const { result } = renderHook(() => useSelection<typeof items[0]>());

      act(() => {
        result.current.select(items[0]!);
      });

      expect(result.current.selected).toEqual([items[0]]);
      expect(result.current.isSelected(items[0]!)).toBe(true);
    });

    it('should deselect an item', () => {
      const { result } = renderHook(() =>
        useSelection({ initialSelected: [items[0]!] })
      );

      act(() => {
        result.current.deselect(items[0]!);
      });

      expect(result.current.selected).toEqual([]);
      expect(result.current.isSelected(items[0]!)).toBe(false);
    });

    it('should not duplicate selection', () => {
      const { result } = renderHook(() => useSelection<typeof items[0]>());

      act(() => {
        result.current.select(items[0]!);
        result.current.select(items[0]!);
      });

      expect(result.current.selected).toHaveLength(1);
    });
  });

  describe('toggle', () => {
    it('should toggle item selection', () => {
      const { result } = renderHook(() => useSelection<typeof items[0]>());

      act(() => {
        result.current.toggle(items[0]!);
      });

      expect(result.current.isSelected(items[0]!)).toBe(true);

      act(() => {
        result.current.toggle(items[0]!);
      });

      expect(result.current.isSelected(items[0]!)).toBe(false);
    });
  });

  describe('selectAll/deselectAll', () => {
    it('should select all items', () => {
      const { result } = renderHook(() => useSelection<typeof items[0]>());

      act(() => {
        result.current.selectAll(items);
      });

      expect(result.current.selected).toHaveLength(4);
      expect(result.current.isAllSelected(items)).toBe(true);
    });

    it('should deselect all items', () => {
      const { result } = renderHook(() =>
        useSelection({ initialSelected: [...items] })
      );

      act(() => {
        result.current.deselectAll();
      });

      expect(result.current.selected).toEqual([]);
      expect(result.current.hasSelection).toBe(false);
    });
  });

  describe('toggleAll', () => {
    it('should toggle all items', () => {
      const { result } = renderHook(() => useSelection<typeof items[0]>());

      act(() => {
        result.current.toggleAll(items);
      });

      expect(result.current.isAllSelected(items)).toBe(true);

      act(() => {
        result.current.toggleAll(items);
      });

      expect(result.current.hasSelection).toBe(false);
    });
  });

  describe('single selection mode', () => {
    it('should only allow one selection when multiple is false', () => {
      const { result } = renderHook(() =>
        useSelection<typeof items[0]>({ multiple: false })
      );

      act(() => {
        result.current.select(items[0]!);
      });

      expect(result.current.selected).toEqual([items[0]]);

      act(() => {
        result.current.select(items[1]!);
      });

      expect(result.current.selected).toEqual([items[1]]);
      expect(result.current.count).toBe(1);
    });
  });

  describe('max selection', () => {
    it('should respect max selection limit', () => {
      const { result } = renderHook(() =>
        useSelection<typeof items[0]>({ max: 2 })
      );

      act(() => {
        result.current.select(items[0]!);
      });
      
      act(() => {
        result.current.select(items[1]!);
      });
      
      act(() => {
        result.current.select(items[2]!);
      });

      // After selecting 3 items with max 2, only first 2 should be selected
      expect(result.current.selected).toHaveLength(2);
      expect(result.current.isSelected(items[0]!)).toBe(true);
      expect(result.current.isSelected(items[1]!)).toBe(true);
      expect(result.current.isSelected(items[2]!)).toBe(false);
    });
  });

  describe('onChange callback', () => {
    it('should call onChange when selection changes', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection<typeof items[0]>({ onChange })
      );

      act(() => {
        result.current.select(items[0]!);
      });

      expect(onChange).toHaveBeenCalledWith([items[0]]);
    });
  });

  describe('getItemProps', () => {
    it('should return item props', () => {
      const { result } = renderHook(() => useSelection<typeof items[0]>());

      const props = result.current.getItemProps(items[0]!);

      expect(props.selected).toBe(false);
      expect(typeof props.onClick).toBe('function');
    });

    it('should toggle on click', () => {
      const { result } = renderHook(() => useSelection<typeof items[0]>());

      const props = result.current.getItemProps(items[0]!);

      act(() => {
        props.onClick();
      });

      expect(result.current.isSelected(items[0]!)).toBe(true);
    });
  });

  describe('getSelectAllProps', () => {
    it('should return select all props', () => {
      const { result } = renderHook(() => useSelection<typeof items[0]>());

      const props = result.current.getSelectAllProps(items);

      expect(props.checked).toBe(false);
      expect(props.indeterminate).toBe(false);
      expect(typeof props.onChange).toBe('function');
    });

    it('should show indeterminate when some selected', () => {
      const { result } = renderHook(() =>
        useSelection({ initialSelected: [items[0]!] })
      );

      const props = result.current.getSelectAllProps(items);

      expect(props.checked).toBe(false);
      expect(props.indeterminate).toBe(true);
    });
  });
});

describe('useCheckboxGroup', () => {
  it('should initialize with empty checked', () => {
    const { result } = renderHook(() => useCheckboxGroup());

    expect(result.current.checked).toEqual([]);
  });

  it('should initialize with initial checked', () => {
    const { result } = renderHook(() =>
      useCheckboxGroup({ initialChecked: ['a', 'b'] })
    );

    expect(result.current.checked).toEqual(['a', 'b']);
  });

  it('should check and uncheck values', () => {
    const { result } = renderHook(() => useCheckboxGroup<string>());

    act(() => {
      result.current.check('a');
    });

    expect(result.current.isChecked('a')).toBe(true);

    act(() => {
      result.current.uncheck('a');
    });

    expect(result.current.isChecked('a')).toBe(false);
  });

  it('should toggle values', () => {
    const { result } = renderHook(() => useCheckboxGroup<string>());

    act(() => {
      result.current.toggle('a');
    });

    expect(result.current.isChecked('a')).toBe(true);

    act(() => {
      result.current.toggle('a');
    });

    expect(result.current.isChecked('a')).toBe(false);
  });

  it('should clear all checked', () => {
    const { result } = renderHook(() =>
      useCheckboxGroup({ initialChecked: ['a', 'b', 'c'] })
    );

    act(() => {
      result.current.clear();
    });

    expect(result.current.checked).toEqual([]);
  });

  it('should return checkbox props', () => {
    const { result } = renderHook(() => useCheckboxGroup<string>());

    const props = result.current.getCheckboxProps('a');

    expect(props.checked).toBe(false);
    expect(typeof props.onChange).toBe('function');

    act(() => {
      props.onChange();
    });

    expect(result.current.isChecked('a')).toBe(true);
  });
});

describe('useRadioGroup', () => {
  it('should initialize with undefined value', () => {
    const { result } = renderHook(() => useRadioGroup());

    expect(result.current.value).toBeUndefined();
  });

  it('should initialize with initial value', () => {
    const { result } = renderHook(() =>
      useRadioGroup({ initialValue: 'a' })
    );

    expect(result.current.value).toBe('a');
    expect(result.current.isSelected('a')).toBe(true);
  });

  it('should select a value', () => {
    const { result } = renderHook(() => useRadioGroup<string>());

    act(() => {
      result.current.select('a');
    });

    expect(result.current.value).toBe('a');
  });

  it('should replace selection on new select', () => {
    const { result } = renderHook(() =>
      useRadioGroup({ initialValue: 'a' })
    );

    act(() => {
      result.current.select('b');
    });

    expect(result.current.value).toBe('b');
    expect(result.current.isSelected('a')).toBe(false);
    expect(result.current.isSelected('b')).toBe(true);
  });

  it('should clear value', () => {
    const { result } = renderHook(() =>
      useRadioGroup({ initialValue: 'a' })
    );

    act(() => {
      result.current.clear();
    });

    expect(result.current.value).toBeUndefined();
  });

  it('should return radio props', () => {
    const { result } = renderHook(() => useRadioGroup<string>());

    const props = result.current.getRadioProps('a');

    expect(props.checked).toBe(false);
    expect(typeof props.onChange).toBe('function');

    act(() => {
      props.onChange();
    });

    expect(result.current.isSelected('a')).toBe(true);
  });

  it('should call onChange callback', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRadioGroup({ onChange })
    );

    act(() => {
      result.current.select('a');
    });

    expect(onChange).toHaveBeenCalledWith('a');
  });
});
