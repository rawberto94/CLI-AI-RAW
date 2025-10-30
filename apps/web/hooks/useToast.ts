/**
 * useToast Hook
 * Wrapper around react-hot-toast with consistent styling and behavior
 */

'use client';

import toast, { type ToastOptions } from 'react-hot-toast';

export interface ToastConfig extends ToastOptions {
  action?: {
    label: string;
    onClick: () => void;
  };
}

const defaultOptions: ToastOptions = {
  duration: 4000,
  position: 'top-right',
};

export function useToast() {
  const success = (message: string, options?: ToastConfig) => {
    const { action, ...toastOptions } = options || {};
    
    return toast.success(message, {
      ...defaultOptions,
      ...toastOptions,
    });
  };

  const error = (message: string, options?: ToastConfig) => {
    const { action, ...toastOptions } = options || {};
    
    const toastId = toast.error(message, {
      ...defaultOptions,
      duration: 6000, // Longer duration for errors
      ...toastOptions,
    });

    // Add action button if provided
    if (action) {
      // Note: react-hot-toast doesn't natively support action buttons
      // This is a placeholder for future enhancement with custom toast component
      console.log('Action button:', action);
    }

    return toastId;
  };

  const warning = (message: string, options?: ToastConfig) => {
    const { action, ...toastOptions } = options || {};
    
    return toast(message, {
      ...defaultOptions,
      icon: '⚠️',
      ...toastOptions,
    });
  };

  const info = (message: string, options?: ToastConfig) => {
    const { action, ...toastOptions } = options || {};
    
    return toast(message, {
      ...defaultOptions,
      icon: 'ℹ️',
      ...toastOptions,
    });
  };

  const loading = (message: string, options?: ToastOptions) => {
    return toast.loading(message, {
      ...defaultOptions,
      ...options,
    });
  };

  const promise = <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: ToastOptions
  ) => {
    return toast.promise(
      promise,
      messages,
      {
        ...defaultOptions,
        ...options,
      }
    );
  };

  const dismiss = (toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  };

  const custom = (
    component: (t: any) => React.ReactElement,
    options?: ToastOptions
  ) => {
    return toast.custom(component, {
      ...defaultOptions,
      ...options,
    });
  };

  return {
    success,
    error,
    warning,
    info,
    loading,
    promise,
    dismiss,
    custom,
  };
}
