/**
 * Toast Types
 * Shared type definitions for the toast notification system
 */

export interface Toast {
  id: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  variant?: 'default' | 'destructive';
  title: string;
  message?: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}
