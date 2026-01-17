'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive' | 'warning';
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

const variantConfig = {
  default: {
    icon: Info,
    iconClass: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50',
    buttonClass: 'bg-blue-600 hover:bg-blue-700',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50',
    buttonClass: 'bg-amber-600 hover:bg-amber-700',
  },
  destructive: {
    icon: Trash2,
    iconClass: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50',
    buttonClass: 'bg-red-600 hover:bg-red-700',
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const [isPending, setIsPending] = React.useState(false);
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Action failed silently
    } finally {
      setIsPending(false);
    }
  };

  const loading = isLoading || isPending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn('p-2 rounded-full', config.iconClass)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading}
            className={cn(config.buttonClass, 'min-w-[100px]')}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook to manage confirm dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<{
    title: string;
    description: string;
    variant: 'default' | 'destructive' | 'warning';
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const confirm = React.useCallback(
    (options: {
      title: string;
      description: string;
      variant?: 'default' | 'destructive' | 'warning';
      confirmLabel?: string;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfig({
          title: options.title,
          description: options.description,
          variant: options.variant || 'default',
          confirmLabel: options.confirmLabel || 'Confirm',
          onConfirm: () => resolve(true),
        });
        setIsOpen(true);
      });
    },
    []
  );

  const handleOpenChange = React.useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setConfig(null);
    }
  }, []);

  const ConfirmDialogComponent = config ? (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title={config.title}
      description={config.description}
      variant={config.variant}
      confirmLabel={config.confirmLabel}
      onConfirm={config.onConfirm}
    />
  ) : null;

  return {
    confirm,
    ConfirmDialogComponent,
    isOpen,
  };
}
