/**
 * Toast Type Definitions
 * Shared types for toast notifications
 */

export interface Toast {
  id: string;
  type?: "success" | "error" | "info" | "warning";
  /** Shadcn/ui compatibility: "destructive" maps to "error" */
  variant?: "default" | "destructive";
  title: string;
  message?: string;
  /** Alias for message - for compatibility */
  description?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastProps extends Toast {
  onDismiss: (id: string) => void;
}
