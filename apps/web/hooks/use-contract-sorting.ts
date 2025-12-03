/**
 * Contract Sorting Hook
 * 
 * Manages sorting state and logic for contract lists.
 */

import { useState, useMemo, useCallback } from 'react';
import type { Contract } from './use-queries';

// ============================================================================
// Types
// ============================================================================

export type SortField = 'title' | 'createdAt' | 'value' | 'expirationDate' | 'status' | 'riskScore';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export interface SortActions {
  setField: (field: SortField) => void;
  setDirection: (direction: SortDirection) => void;
  toggleDirection: () => void;
  setSorting: (field: SortField, direction?: SortDirection) => void;
}

export interface UseContractSortingResult {
  state: SortState;
  actions: SortActions;
  sortedContracts: Contract[];
}

// ============================================================================
// Sort Options Configuration
// ============================================================================

export const SORT_OPTIONS: Array<{ field: SortField; label: string; icon?: string }> = [
  { field: 'createdAt', label: 'Date Created' },
  { field: 'title', label: 'Title' },
  { field: 'value', label: 'Contract Value' },
  { field: 'expirationDate', label: 'Expiration Date' },
  { field: 'status', label: 'Status' },
  { field: 'riskScore', label: 'Risk Score' },
];

// ============================================================================
// Hook Implementation
// ============================================================================

export function useContractSorting(
  contracts: Contract[],
  initialField: SortField = 'createdAt',
  initialDirection: SortDirection = 'desc'
): UseContractSortingResult {
  const [field, setField] = useState<SortField>(initialField);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);

  // Toggle direction
  const toggleDirection = useCallback(() => {
    setDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  // Set sorting with optional direction
  const setSorting = useCallback((newField: SortField, newDirection?: SortDirection) => {
    if (newField === field && !newDirection) {
      // Same field - toggle direction
      toggleDirection();
    } else {
      setField(newField);
      setDirection(newDirection || 'desc');
    }
  }, [field, toggleDirection]);

  // Sort contracts
  const sortedContracts = useMemo(() => {
    if (!Array.isArray(contracts)) return [];

    return [...contracts].sort((a, b) => {
      let comparison = 0;

      switch (field) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case 'value':
          comparison = (a.value || 0) - (b.value || 0);
          break;
        case 'expirationDate':
          comparison = new Date(a.expirationDate || 0).getTime() - new Date(b.expirationDate || 0).getTime();
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'riskScore':
          comparison = (a.riskScore || 0) - (b.riskScore || 0);
          break;
        default:
          comparison = 0;
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  }, [contracts, field, direction]);

  return {
    state: { field, direction },
    actions: { setField, setDirection, toggleDirection, setSorting },
    sortedContracts,
  };
}

export default useContractSorting;
