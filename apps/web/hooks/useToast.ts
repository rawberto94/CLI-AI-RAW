/**
 * useToast Hook
 * Wrapper around sonner with consistent styling and behavior
 */

'use client';

import { toast, type ExternalToast } from 'sonner';

export interface ToastConfig extends ExternalToast {
  action?: {
    label: string;
    onClick: () => void;
  };
}

const defaultOptions: ExternalToast = {
  duration: 4000,
};

export function useToast() {
  const success = (message: string, options?: ToastConfig) => {
    const { action, ...toastOptions } = options || {};
    
    return toast.success(message, {
      ...defaultOptions,
      ...toastOptions,
      ...(action ? { action: { label: action.label, onClick: action.onClick } } : {}),
    });
  };

  const error = (message: string, options?: ToastConfig) => {
    const { action, ...toastOptions } = options || {};
    
    return toast.error(message, {
      ...defaultOptions,
      duration: 6000, // Longer duration for errors
      ...toastOptions,
      ...(action ? { action: { label: action.label, onClick: action.onClick } } : {}),
    });
  };

  const warning = (message: string, options?: ToastConfig) => {
    const { action, ...toastOptions } = options || {};
    
    return toast.warning(message, {
      ...defaultOptions,
      ...toastOptions,
    });
  };

  const info = (message: string, options?: ToastConfig) => {
    const { action, ...toastOptions } = options || {};
    
    return toast.info(message, {
      ...defaultOptions,
      ...toastOptions,
    });
  };

  const loading = (message: string, options?: ExternalToast) => {
    return toast.loading(message, {
      ...defaultOptions,
      ...options,
    });
  };

  const promise = <T,>(
    promiseOrFn: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: ExternalToast
  ) => {
    return toast.promise(
      promiseOrFn,
      { ...messages, ...options },
    );
  };

  const dismiss = (toastId?: string | number) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  };

  const custom = (
    component: (id: string | number) => React.ReactElement,
    options?: ExternalToast
  ) => {
    return toast.custom(
      (id) => component(id),
      {
        ...defaultOptions,
        ...options,
      }
    );
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
