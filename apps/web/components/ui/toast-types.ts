/**
 * Toast Type Definitions
 * Shared types for toast notifications
 */

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
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
