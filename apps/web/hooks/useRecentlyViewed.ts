/**
 * Recently Viewed Hook
 * Tracks and retrieves recently viewed items with localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';

interface RecentItem {
  id: string;
  title: string;
  type: string;
  href: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface UseRecentlyViewedOptions {
  /** Storage key for localStorage */
  storageKey?: string;
  /** Maximum number of items to store */
  maxItems?: number;
  /** Filter items by type */
  filterType?: string;
}

interface UseRecentlyViewedReturn {
  /** Recently viewed items */
  items: RecentItem[];
  /** Add an item to recently viewed */
  addItem: (item: Omit<RecentItem, 'timestamp'>) => void;
  /** Clear all recently viewed items */
  clearAll: () => void;
  /** Remove a specific item */
  removeItem: (id: string) => void;
  /** Get items by type */
  getItemsByType: (type: string) => RecentItem[];
}

export function useRecentlyViewed({
  storageKey = 'recentlyViewed',
  maxItems = 10,
  filterType,
}: UseRecentlyViewedOptions = {}): UseRecentlyViewedReturn {
  const [items, setItems] = useState<RecentItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentItem[];
        setItems(parsed);
      }
    } catch (error) {
      console.error('Failed to load recently viewed:', error);
    }
  }, [storageKey]);

  // Save to localStorage whenever items change
  const saveToStorage = useCallback((newItems: RecentItem[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newItems));
    } catch (error) {
      console.error('Failed to save recently viewed:', error);
    }
  }, [storageKey]);

  // Add item
  const addItem = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
    setItems(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(i => i.id !== item.id);
      
      // Add new item at the beginning
      const newItems = [
        { ...item, timestamp: Date.now() },
        ...filtered
      ].slice(0, maxItems);

      saveToStorage(newItems);
      return newItems;
    });
  }, [maxItems, saveToStorage]);

  // Clear all
  const clearAll = useCallback(() => {
    setItems([]);
    saveToStorage([]);
  }, [saveToStorage]);

  // Remove specific item
  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const newItems = prev.filter(i => i.id !== id);
      saveToStorage(newItems);
      return newItems;
    });
  }, [saveToStorage]);

  // Get items by type
  const getItemsByType = useCallback((type: string) => {
    return items.filter(item => item.type === type);
  }, [items]);

  // Filter by type if specified
  const filteredItems = filterType 
    ? items.filter(item => item.type === filterType)
    : items;

  return {
    items: filteredItems,
    addItem,
    clearAll,
    removeItem,
    getItemsByType,
  };
}

/**
 * Hook for tracking contract views
 */
export function useRecentContracts() {
  return useRecentlyViewed({
    storageKey: 'recentContracts',
    filterType: 'contract',
    maxItems: 15,
  });
}

/**
 * Hook for tracking rate card views
 */
export function useRecentRateCards() {
  return useRecentlyViewed({
    storageKey: 'recentRateCards',
    filterType: 'rate-card',
    maxItems: 10,
  });
}
