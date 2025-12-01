'use client';

/**
 * useLocalStorage Hook
 * 
 * A type-safe hook for managing localStorage with React state synchronization.
 * Handles SSR, JSON serialization, and cross-tab synchronization.
 */

import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = T | ((prevValue: T) => T);

interface UseLocalStorageOptions<T> {
  /** Serializer function (default: JSON.stringify) */
  serializer?: (value: T) => string;
  /** Deserializer function (default: JSON.parse) */
  deserializer?: (value: string) => T;
  /** Sync across tabs (default: true) */
  syncTabs?: boolean;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, (value: SetValue<T>) => void, () => void] {
  const {
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    syncTabs = true,
  } = options;

  // Get initial value from localStorage or use provided initial value
  const readValue = useCallback((): T => {
    // SSR guard
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? deserializer(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue, deserializer]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that persists to localStorage
  const setValue = useCallback(
    (value: SetValue<T>) => {
      // SSR guard
      if (typeof window === 'undefined') {
        console.warn(
          `Tried setting localStorage key "${key}" even though environment is not a client`
        );
        return;
      }

      try {
        // Allow value to be a function (like useState)
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        
        // Save to state
        setStoredValue(valueToStore);
        
        // Save to localStorage
        window.localStorage.setItem(key, serializer(valueToStore));
        
        // Dispatch event for cross-tab sync
        window.dispatchEvent(new StorageEvent('storage', {
          key,
          newValue: serializer(valueToStore),
        }));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, serializer, storedValue]
  );

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    // SSR guard
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
      
      // Dispatch event for cross-tab sync
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: null,
      }));
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Listen for changes in other tabs/windows
  useEffect(() => {
    if (!syncTabs) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== key) return;
      
      try {
        const newValue = event.newValue ? deserializer(event.newValue) : initialValue;
        setStoredValue(newValue);
      } catch (error) {
        console.warn(`Error parsing storage event for key "${key}":`, error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue, deserializer, syncTabs]);

  // Read value on mount (handles hydration)
  useEffect(() => {
    setStoredValue(readValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [storedValue, setValue, removeValue];
}

/**
 * Hook for storing recent items (e.g., recent searches, recent files)
 */
export function useRecentItems<T>(
  key: string,
  maxItems: number = 10
): {
  items: T[];
  addItem: (item: T) => void;
  removeItem: (item: T) => void;
  clearItems: () => void;
} {
  const [items, setItems, removeAll] = useLocalStorage<T[]>(key, []);

  const addItem = useCallback(
    (item: T) => {
      setItems((prev) => {
        // Remove duplicates and add new item at the beginning
        const filtered = prev.filter(
          (i) => JSON.stringify(i) !== JSON.stringify(item)
        );
        return [item, ...filtered].slice(0, maxItems);
      });
    },
    [setItems, maxItems]
  );

  const removeItem = useCallback(
    (item: T) => {
      setItems((prev) =>
        prev.filter((i) => JSON.stringify(i) !== JSON.stringify(item))
      );
    },
    [setItems]
  );

  return {
    items,
    addItem,
    removeItem,
    clearItems: removeAll,
  };
}

/**
 * Simple boolean toggle stored in localStorage
 */
export function useLocalStorageToggle(
  key: string,
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useLocalStorage(key, initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, [setValue]);

  return [value, toggle, setValue];
}
