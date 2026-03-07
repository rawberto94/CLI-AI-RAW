/**
 * Toggle and State Management Hooks
 * 
 * Common utilities for managing boolean and state toggling patterns.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';

// ============================================================================
// useToggle - Simple boolean toggle
// ============================================================================

export interface UseToggleReturn {
  /** Current toggle state */
  value: boolean;
  /** Toggle the state */
  toggle: () => void;
  /** Set to true */
  setTrue: () => void;
  /** Set to false */
  setFalse: () => void;
  /** Set to specific value */
  setValue: (value: boolean) => void;
}

/**
 * Hook for managing a boolean toggle state
 * 
 * @param initialValue - Initial boolean value (default: false)
 * @returns Object with value and toggle methods
 * 
 * @example
 * ```tsx
 * const { value: isOpen, toggle, setTrue: open, setFalse: close } = useToggle();
 * 
 * <Button onClick={toggle}>Toggle</Button>
 * <Modal open={isOpen} onClose={close}>...</Modal>
 * ```
 */
export function useToggle(initialValue: boolean = false): UseToggleReturn {
  const [value, setValue] = useState(initialValue);
  
  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  
  return useMemo(() => ({
    value,
    toggle,
    setTrue,
    setFalse,
    setValue,
  }), [value, toggle, setTrue, setFalse]);
}

// ============================================================================
// useDisclosure - Modal/Drawer pattern (named alias)
// ============================================================================

export interface UseDisclosureReturn extends UseToggleReturn {
  /** Alias for value */
  isOpen: boolean;
  /** Alias for setTrue */
  onOpen: () => void;
  /** Alias for setFalse */
  onClose: () => void;
  /** Alias for toggle */
  onToggle: () => void;
}

/**
 * Hook for managing disclosure (modal, drawer, dropdown) state
 * Same as useToggle but with conventional naming for UI patterns
 * 
 * @param initialValue - Initial open state (default: false)
 * @returns Object with isOpen state and control methods
 * 
 * @example
 * ```tsx
 * const { isOpen, onOpen, onClose } = useDisclosure();
 * 
 * <Button onClick={onOpen}>Open Modal</Button>
 * <Modal isOpen={isOpen} onClose={onClose}>
 *   <ModalContent />
 * </Modal>
 * ```
 */
export function useDisclosure(initialValue: boolean = false): UseDisclosureReturn {
  const toggle = useToggle(initialValue);
  
  return useMemo(() => ({
    ...toggle,
    isOpen: toggle.value,
    onOpen: toggle.setTrue,
    onClose: toggle.setFalse,
    onToggle: toggle.toggle,
  }), [toggle]);
}

// ============================================================================
// useCycle - Cycle through array of values
// ============================================================================

export interface UseCycleReturn<T> {
  /** Current value */
  value: T | undefined;
  /** Current index */
  index: number;
  /** Move to next value (wraps around) */
  next: () => void;
  /** Move to previous value (wraps around) */
  prev: () => void;
  /** Set specific index */
  setIndex: (index: number) => void;
  /** Set specific value (finds index) */
  setValue: (value: T) => void;
  /** Reset to first value */
  reset: () => void;
}

/**
 * Hook for cycling through a list of values
 * 
 * @param values - Array of values to cycle through
 * @param initialIndex - Starting index (default: 0)
 * @returns Object with current value and cycle methods
 * 
 * @example
 * ```tsx
 * const { value: theme, next: cycleTheme } = useCycle(['light', 'dark', 'auto']);
 * 
 * <Button onClick={cycleTheme}>
 *   Theme: {theme}
 * </Button>
 * ```
 */
export function useCycle<T>(
  values: readonly T[],
  initialIndex: number = 0
): UseCycleReturn<T> {
  const [index, setIndex] = useState(initialIndex);
  
  const value = values[index];
  
  const next = useCallback(() => {
    setIndex(i => (i + 1) % values.length);
  }, [values.length]);
  
  const prev = useCallback(() => {
    setIndex(i => (i - 1 + values.length) % values.length);
  }, [values.length]);
  
  const setValue = useCallback((val: T) => {
    const idx = values.indexOf(val);
    if (idx !== -1) {
      setIndex(idx);
    }
  }, [values]);
  
  const reset = useCallback(() => {
    setIndex(initialIndex);
  }, [initialIndex]);
  
  return useMemo(() => ({
    value,
    index,
    next,
    prev,
    setIndex,
    setValue,
    reset,
  }), [value, index, next, prev, setValue, reset]);
}

// ============================================================================
// useSetState - Object state with partial updates
// ============================================================================

/**
 * Hook for managing object state with partial updates (like class component setState)
 * 
 * @param initialState - Initial state object
 * @returns Tuple of [state, setState, resetState]
 * 
 * @example
 * ```tsx
 * const [form, setForm, resetForm] = useSetState({
 *   name: '',
 *   email: '',
 *   age: 0
 * });
 * 
 * // Partial updates
 * setForm({ name: 'John' }); // Only updates name
 * setForm(prev => ({ age: prev.age + 1 })); // Function updates
 * 
 * // Reset to initial
 * resetForm();
 * ```
 */
export function useSetState<T extends Record<string, any>>(
  initialState: T
): [T, (patch: Partial<T> | ((prev: T) => Partial<T>)) => void, () => void] {
  const [state, setState] = useState<T>(initialState);
  
  const setPartialState = useCallback((
    patch: Partial<T> | ((prev: T) => Partial<T>)
  ) => {
    setState(prev => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  }, []);
  
  const resetState = useCallback(() => {
    setState(initialState);
  }, [initialState]);
  
  return [state, setPartialState, resetState];
}

// ============================================================================
// useCounter - Numeric counter with bounds
// ============================================================================

export interface UseCounterOptions {
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Step increment/decrement amount */
  step?: number;
}

export interface UseCounterReturn {
  /** Current count value */
  count: number;
  /** Increment by step */
  increment: () => void;
  /** Decrement by step */
  decrement: () => void;
  /** Set specific value */
  set: (value: number) => void;
  /** Reset to initial value */
  reset: () => void;
  /** Whether at minimum */
  isMin: boolean;
  /** Whether at maximum */
  isMax: boolean;
}

/**
 * Hook for managing a numeric counter with optional bounds
 * 
 * @param initialValue - Starting count value
 * @param options - Counter options (min, max, step)
 * @returns Object with count and control methods
 * 
 * @example
 * ```tsx
 * const { count, increment, decrement, isMin, isMax } = useCounter(0, {
 *   min: 0,
 *   max: 10,
 *   step: 1
 * });
 * 
 * <Button onClick={decrement} disabled={isMin}>-</Button>
 * <span>{count}</span>
 * <Button onClick={increment} disabled={isMax}>+</Button>
 * ```
 */
export function useCounter(
  initialValue: number = 0,
  options: UseCounterOptions = {}
): UseCounterReturn {
  const { min = -Infinity, max = Infinity, step = 1 } = options;
  
  const [count, setCount] = useState(() => {
    return Math.min(Math.max(initialValue, min), max);
  });
  
  const increment = useCallback(() => {
    setCount(c => Math.min(c + step, max));
  }, [step, max]);
  
  const decrement = useCallback(() => {
    setCount(c => Math.max(c - step, min));
  }, [step, min]);
  
  const set = useCallback((value: number) => {
    setCount(Math.min(Math.max(value, min), max));
  }, [min, max]);
  
  const reset = useCallback(() => {
    setCount(Math.min(Math.max(initialValue, min), max));
  }, [initialValue, min, max]);
  
  const isMin = count <= min;
  const isMax = count >= max;
  
  return useMemo(() => ({
    count,
    increment,
    decrement,
    set,
    reset,
    isMin,
    isMax,
  }), [count, increment, decrement, set, reset, isMin, isMax]);
}

// ============================================================================
// useMap - Map state helper
// ============================================================================

export interface UseMapReturn<K, V> {
  /** Current map state */
  map: Map<K, V>;
  /** Get a value by key */
  get: (key: K) => V | undefined;
  /** Set a key-value pair */
  set: (key: K, value: V) => void;
  /** Delete a key */
  delete: (key: K) => void;
  /** Check if key exists */
  has: (key: K) => boolean;
  /** Clear all entries */
  clear: () => void;
  /** Reset to initial map */
  reset: () => void;
  /** Get all entries as array */
  entries: [K, V][];
  /** Map size */
  size: number;
}

/**
 * Hook for managing Map state
 * 
 * @param initialEntries - Initial map entries
 * @returns Object with map and control methods
 * 
 * @example
 * ```tsx
 * const { map, set, delete: remove, has } = useMap([
 *   ['key1', 'value1']
 * ]);
 * 
 * set('key2', 'value2');
 * if (has('key1')) remove('key1');
 * ```
 */
export function useMap<K, V>(
  initialEntries: Iterable<readonly [K, V]> = []
): UseMapReturn<K, V> {
  const [map, setMap] = useState(() => new Map<K, V>(initialEntries));
  
  const get = useCallback((key: K) => map.get(key), [map]);
  
  const set = useCallback((key: K, value: V) => {
    setMap(m => new Map(m).set(key, value));
  }, []);
  
  const deleteKey = useCallback((key: K) => {
    setMap(m => {
      const newMap = new Map(m);
      newMap.delete(key);
      return newMap;
    });
  }, []);
  
  const has = useCallback((key: K) => map.has(key), [map]);
  
  const clear = useCallback(() => {
    setMap(new Map<K, V>());
  }, []);
  
  const reset = useCallback(() => {
    setMap(new Map<K, V>(initialEntries));
  }, [initialEntries]);
  
  return useMemo(() => ({
    map,
    get,
    set,
    delete: deleteKey,
    has,
    clear,
    reset,
    entries: Array.from(map.entries()),
    size: map.size,
  }), [map, get, set, deleteKey, has, clear, reset]);
}

// ============================================================================
// useSet - Set state helper
// ============================================================================

export interface UseSetReturn<T> {
  /** Current set state */
  set: Set<T>;
  /** Add a value */
  add: (value: T) => void;
  /** Remove a value */
  remove: (value: T) => void;
  /** Toggle a value */
  toggle: (value: T) => void;
  /** Check if value exists */
  has: (value: T) => boolean;
  /** Clear all values */
  clear: () => void;
  /** Reset to initial set */
  reset: () => void;
  /** Get all values as array */
  values: T[];
  /** Set size */
  size: number;
}

/**
 * Hook for managing Set state
 * 
 * @param initialValues - Initial set values
 * @returns Object with set and control methods
 * 
 * @example
 * ```tsx
 * const { set, add, remove, toggle, has } = useSet(['item1']);
 * 
 * toggle('item2'); // Adds item2
 * toggle('item1'); // Removes item1
 * ```
 */
export function useSet<T>(
  initialValues: Iterable<T> = []
): UseSetReturn<T> {
  const [set, setSet] = useState(() => new Set<T>(initialValues));
  
  const add = useCallback((value: T) => {
    setSet(s => new Set(s).add(value));
  }, []);
  
  const remove = useCallback((value: T) => {
    setSet(s => {
      const newSet = new Set(s);
      newSet.delete(value);
      return newSet;
    });
  }, []);
  
  const toggle = useCallback((value: T) => {
    setSet(s => {
      const newSet = new Set(s);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return newSet;
    });
  }, []);
  
  const has = useCallback((value: T) => set.has(value), [set]);
  
  const clear = useCallback(() => {
    setSet(new Set<T>());
  }, []);
  
  const reset = useCallback(() => {
    setSet(new Set<T>(initialValues));
  }, [initialValues]);
  
  return useMemo(() => ({
    set,
    add,
    remove,
    toggle,
    has,
    clear,
    reset,
    values: Array.from(set),
    size: set.size,
  }), [set, add, remove, toggle, has, clear, reset]);
}
