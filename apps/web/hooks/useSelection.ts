"use client";

/**
 * useSelection Hook
 * 
 * Multi-selection state management for lists, tables, etc.
 */

import { useState, useCallback, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export interface UseSelectionOptions<T> {
  /** Initial selected items */
  initialSelected?: T[];
  /** Allow multiple selection */
  multiple?: boolean;
  /** Maximum selections allowed */
  max?: number;
  /** Callback when selection changes */
  onChange?: (selected: T[]) => void;
  /** Key extractor for comparison */
  getKey?: (item: T) => string | number;
}

export interface UseSelectionReturn<T> {
  /** Currently selected items */
  selected: T[];
  /** Selected keys for quick lookup */
  selectedKeys: Set<string | number>;
  /** Number of selected items */
  count: number;
  /** Whether any items are selected */
  hasSelection: boolean;
  /** Whether all items in a list are selected */
  isAllSelected: (items: T[]) => boolean;
  /** Whether some (but not all) items are selected */
  isSomeSelected: (items: T[]) => boolean;
  /** Check if specific item is selected */
  isSelected: (item: T) => boolean;
  /** Select an item */
  select: (item: T) => void;
  /** Deselect an item */
  deselect: (item: T) => void;
  /** Toggle selection of an item */
  toggle: (item: T) => void;
  /** Select all items */
  selectAll: (items: T[]) => void;
  /** Deselect all items */
  deselectAll: () => void;
  /** Toggle all items */
  toggleAll: (items: T[]) => void;
  /** Select a range of items (shift+click behavior) */
  selectRange: (items: T[], fromIndex: number, toIndex: number) => void;
  /** Replace selection with new items */
  setSelection: (items: T[]) => void;
  /** Get props for a selectable item */
  getItemProps: (item: T) => {
    selected: boolean;
    onClick: () => void;
  };
  /** Get props for select all checkbox */
  getSelectAllProps: (items: T[]) => {
    checked: boolean;
    indeterminate: boolean;
    onChange: () => void;
  };
}

// ============================================================================
// useSelection Hook
// ============================================================================

export function useSelection<T>(
  options: UseSelectionOptions<T> = {}
): UseSelectionReturn<T> {
  const {
    initialSelected = [],
    multiple = true,
    max,
    onChange,
    getKey = (item: T) => {
      if (typeof item === "object" && item !== null && "id" in item) {
        return (item as { id: string | number }).id;
      }
      return String(item);
    },
  } = options;

  const [selected, setSelectedState] = useState<T[]>(initialSelected);

  const selectedKeys = useMemo(() => {
    return new Set(selected.map(getKey));
  }, [selected, getKey]);

  const count = selected.length;
  const hasSelection = count > 0;

  const setSelected = useCallback(
    (newSelected: T[]) => {
      setSelectedState(newSelected);
      onChange?.(newSelected);
    },
    [onChange]
  );

  const isSelected = useCallback(
    (item: T): boolean => {
      return selectedKeys.has(getKey(item));
    },
    [selectedKeys, getKey]
  );

  const isAllSelected = useCallback(
    (items: T[]): boolean => {
      if (items.length === 0) return false;
      return items.every((item) => isSelected(item));
    },
    [isSelected]
  );

  const isSomeSelected = useCallback(
    (items: T[]): boolean => {
      if (items.length === 0) return false;
      const selectedCount = items.filter((item) => isSelected(item)).length;
      return selectedCount > 0 && selectedCount < items.length;
    },
    [isSelected]
  );

  const select = useCallback(
    (item: T) => {
      if (isSelected(item)) return;

      if (!multiple) {
        setSelected([item]);
        return;
      }

      if (max !== undefined && selected.length >= max) {
        return;
      }

      setSelected([...selected, item]);
    },
    [isSelected, multiple, max, selected, setSelected]
  );

  const deselect = useCallback(
    (item: T) => {
      const key = getKey(item);
      setSelected(selected.filter((s) => getKey(s) !== key));
    },
    [selected, getKey, setSelected]
  );

  const toggle = useCallback(
    (item: T) => {
      if (isSelected(item)) {
        deselect(item);
      } else {
        select(item);
      }
    },
    [isSelected, select, deselect]
  );

  const selectAll = useCallback(
    (items: T[]) => {
      if (!multiple) {
        const firstItem = items[0];
        if (items.length > 0 && firstItem !== undefined) {
          setSelected([firstItem]);
        }
        return;
      }

      const newSelected = [...selected];
      for (const item of items) {
        if (!isSelected(item)) {
          if (max !== undefined && newSelected.length >= max) {
            break;
          }
          newSelected.push(item);
        }
      }
      setSelected(newSelected);
    },
    [multiple, selected, isSelected, max, setSelected]
  );

  const deselectAll = useCallback(() => {
    setSelected([]);
  }, [setSelected]);

  const toggleAll = useCallback(
    (items: T[]) => {
      if (isAllSelected(items)) {
        // Deselect only items in the list
        const keys = new Set(items.map(getKey));
        setSelected(selected.filter((s) => !keys.has(getKey(s))));
      } else {
        selectAll(items);
      }
    },
    [isAllSelected, selected, getKey, setSelected, selectAll]
  );

  const selectRange = useCallback(
    (items: T[], fromIndex: number, toIndex: number) => {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const rangeItems = items.slice(start, end + 1);
      
      if (!multiple) {
        const targetItem = items[toIndex];
        if (targetItem !== undefined) {
          setSelected([targetItem]);
        }
        return;
      }

      const newSelected = [...selected];
      for (const item of rangeItems) {
        if (!isSelected(item)) {
          if (max !== undefined && newSelected.length >= max) {
            break;
          }
          newSelected.push(item);
        }
      }
      setSelected(newSelected);
    },
    [multiple, selected, isSelected, max, setSelected]
  );

  const setSelection = useCallback(
    (items: T[]) => {
      if (!multiple && items.length > 1) {
        const firstItem = items[0];
        if (firstItem !== undefined) {
          setSelected([firstItem]);
        }
      } else if (max !== undefined && items.length > max) {
        setSelected(items.slice(0, max));
      } else {
        setSelected(items);
      }
    },
    [multiple, max, setSelected]
  );

  const getItemProps = useCallback(
    (item: T) => ({
      selected: isSelected(item),
      onClick: () => toggle(item),
    }),
    [isSelected, toggle]
  );

  const getSelectAllProps = useCallback(
    (items: T[]) => ({
      checked: isAllSelected(items),
      indeterminate: isSomeSelected(items),
      onChange: () => toggleAll(items),
    }),
    [isAllSelected, isSomeSelected, toggleAll]
  );

  return {
    selected,
    selectedKeys,
    count,
    hasSelection,
    isAllSelected,
    isSomeSelected,
    isSelected,
    select,
    deselect,
    toggle,
    selectAll,
    deselectAll,
    toggleAll,
    selectRange,
    setSelection,
    getItemProps,
    getSelectAllProps,
  };
}

// ============================================================================
// useSelectionWithShift Hook (Enhanced with shift-click)
// ============================================================================

export interface UseSelectionWithShiftOptions<T> extends UseSelectionOptions<T> {
  /** All items in the list (for shift-click) */
  items: T[];
}

export interface UseSelectionWithShiftReturn<T> extends UseSelectionReturn<T> {
  /** Handle click with shift/ctrl modifiers */
  handleClick: (item: T, event: React.MouseEvent) => void;
  /** Last clicked index for shift-select */
  lastClickedIndex: number | null;
}

export function useSelectionWithShift<T>(
  options: UseSelectionWithShiftOptions<T>
): UseSelectionWithShiftReturn<T> {
  const { items, getKey, ...selectionOptions } = options;
  const selection = useSelection<T>({ ...selectionOptions, getKey });
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const keyFn = getKey ?? ((item: T) => {
    if (typeof item === "object" && item !== null && "id" in item) {
      return (item as { id: string | number }).id;
    }
    return String(item);
  });

  const handleClick = useCallback(
    (item: T, event: React.MouseEvent) => {
      const currentIndex = items.findIndex((i) => keyFn(i) === keyFn(item));

      if (event.shiftKey && lastClickedIndex !== null && selectionOptions.multiple !== false) {
        // Shift-click: select range
        selection.selectRange(items, lastClickedIndex, currentIndex);
      } else if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd-click: toggle single item
        selection.toggle(item);
      } else {
        // Normal click: select only this item (or toggle in single mode)
        if (selectionOptions.multiple === false) {
          selection.toggle(item);
        } else {
          selection.setSelection([item]);
        }
      }

      setLastClickedIndex(currentIndex);
    },
    [items, lastClickedIndex, selection, selectionOptions.multiple, keyFn]
  );

  return {
    ...selection,
    handleClick,
    lastClickedIndex,
  };
}

// ============================================================================
// useCheckboxGroup Hook
// ============================================================================

export interface UseCheckboxGroupOptions<T extends string = string> {
  /** Initial checked values */
  initialChecked?: T[];
  /** Callback when checked changes */
  onChange?: (checked: T[]) => void;
}

export interface UseCheckboxGroupReturn<T extends string = string> {
  /** Currently checked values */
  checked: T[];
  /** Check if value is checked */
  isChecked: (value: T) => boolean;
  /** Toggle a value */
  toggle: (value: T) => void;
  /** Check a value */
  check: (value: T) => void;
  /** Uncheck a value */
  uncheck: (value: T) => void;
  /** Set checked values */
  setChecked: (values: T[]) => void;
  /** Clear all */
  clear: () => void;
  /** Get props for a checkbox */
  getCheckboxProps: (value: T) => {
    checked: boolean;
    onChange: () => void;
  };
}

export function useCheckboxGroup<T extends string = string>(
  options: UseCheckboxGroupOptions<T> = {}
): UseCheckboxGroupReturn<T> {
  const { initialChecked = [], onChange } = options;
  const [checked, setCheckedState] = useState<T[]>(initialChecked);

  const checkedSet = useMemo(() => new Set(checked), [checked]);

  const setChecked = useCallback(
    (values: T[]) => {
      setCheckedState(values);
      onChange?.(values);
    },
    [onChange]
  );

  const isChecked = useCallback(
    (value: T): boolean => checkedSet.has(value),
    [checkedSet]
  );

  const toggle = useCallback(
    (value: T) => {
      const newChecked = isChecked(value)
        ? checked.filter((v) => v !== value)
        : [...checked, value];
      setChecked(newChecked);
    },
    [checked, isChecked, setChecked]
  );

  const check = useCallback(
    (value: T) => {
      if (!isChecked(value)) {
        setChecked([...checked, value]);
      }
    },
    [checked, isChecked, setChecked]
  );

  const uncheck = useCallback(
    (value: T) => {
      if (isChecked(value)) {
        setChecked(checked.filter((v) => v !== value));
      }
    },
    [checked, isChecked, setChecked]
  );

  const clear = useCallback(() => {
    setChecked([]);
  }, [setChecked]);

  const getCheckboxProps = useCallback(
    (value: T) => ({
      checked: isChecked(value),
      onChange: () => toggle(value),
    }),
    [isChecked, toggle]
  );

  return {
    checked,
    isChecked,
    toggle,
    check,
    uncheck,
    setChecked,
    clear,
    getCheckboxProps,
  };
}

// ============================================================================
// useRadioGroup Hook
// ============================================================================

export interface UseRadioGroupOptions<T extends string = string> {
  /** Initial selected value */
  initialValue?: T;
  /** Callback when value changes */
  onChange?: (value: T) => void;
}

export interface UseRadioGroupReturn<T extends string = string> {
  /** Currently selected value */
  value: T | undefined;
  /** Check if value is selected */
  isSelected: (value: T) => boolean;
  /** Select a value */
  select: (value: T) => void;
  /** Clear selection */
  clear: () => void;
  /** Get props for a radio button */
  getRadioProps: (radioValue: T) => {
    checked: boolean;
    onChange: () => void;
  };
}

export function useRadioGroup<T extends string = string>(
  options: UseRadioGroupOptions<T> = {}
): UseRadioGroupReturn<T> {
  const { initialValue, onChange } = options;
  const [value, setValue] = useState<T | undefined>(initialValue);

  const isSelected = useCallback(
    (radioValue: T): boolean => value === radioValue,
    [value]
  );

  const select = useCallback(
    (radioValue: T) => {
      setValue(radioValue);
      onChange?.(radioValue);
    },
    [onChange]
  );

  const clear = useCallback(() => {
    setValue(undefined);
  }, []);

  const getRadioProps = useCallback(
    (radioValue: T) => ({
      checked: isSelected(radioValue),
      onChange: () => select(radioValue),
    }),
    [isSelected, select]
  );

  return {
    value,
    isSelected,
    select,
    clear,
    getRadioProps,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useSelection;
