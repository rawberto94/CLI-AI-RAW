"use client";

/**
 * useModal Hook
 * 
 * Enhanced modal management with data passing, confirmation dialogs,
 * and integration with radix-ui Dialog components.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

export interface UseModalOptions<T = undefined> {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Called when modal opens */
  onOpen?: (data?: T) => void;
  /** Called when modal closes */
  onClose?: () => void;
  /** Close on escape key */
  closeOnEscape?: boolean;
  /** Close on overlay click */
  closeOnOverlay?: boolean;
}

export interface UseModalReturn<T = undefined> {
  /** Whether modal is open */
  isOpen: boolean;
  /** Data passed to the modal */
  data: T | undefined;
  /** Open the modal (optionally with data) */
  open: (data?: T) => void;
  /** Close the modal */
  close: () => void;
  /** Toggle the modal */
  toggle: () => void;
  /** Props to spread on Dialog component */
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
}

// ============================================================================
// useModal Hook
// ============================================================================

export function useModal<T = undefined>(
  options: UseModalOptions<T> = {}
): UseModalReturn<T> {
  const {
    defaultOpen = false,
    onOpen,
    onClose,
  } = options;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [data, setData] = useState<T | undefined>(undefined);

  const open = useCallback((modalData?: T) => {
    setData(modalData);
    setIsOpen(true);
    onOpen?.(modalData);
  }, [onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(undefined);
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      open();
    } else {
      close();
    }
  }, [open, close]);

  const dialogProps = useMemo(() => ({
    open: isOpen,
    onOpenChange: handleOpenChange,
  }), [isOpen, handleOpenChange]);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    dialogProps,
  };
}

// ============================================================================
// useConfirmModal Hook
// ============================================================================

export interface ConfirmModalOptions {
  /** Default title */
  defaultTitle?: string;
  /** Default description */
  defaultDescription?: string;
  /** Default confirm text */
  defaultConfirmText?: string;
  /** Default cancel text */
  defaultCancelText?: string;
  /** Default destructive state */
  defaultDestructive?: boolean;
}

export interface ConfirmModalData {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface UseConfirmModalReturn {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  isLoading: boolean;
  open: (options: ConfirmModalData) => void;
  close: () => void;
  confirm: () => Promise<void>;
  cancel: () => void;
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
}

export function useConfirmModal(
  options: ConfirmModalOptions = {}
): UseConfirmModalReturn {
  const {
    defaultTitle = "Are you sure?",
    defaultDescription = "This action cannot be undone.",
    defaultConfirmText = "Confirm",
    defaultCancelText = "Cancel",
    defaultDestructive = false,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ConfirmModalData>({});

  const title = config.title ?? defaultTitle;
  const description = config.description ?? defaultDescription;
  const confirmText = config.confirmText ?? defaultConfirmText;
  const cancelText = config.cancelText ?? defaultCancelText;
  const destructive = config.destructive ?? defaultDestructive;

  const open = useCallback((newConfig: ConfirmModalData) => {
    setConfig(newConfig);
    setIsOpen(true);
    setIsLoading(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setConfig({});
    setIsLoading(false);
  }, []);

  const confirm = useCallback(async () => {
    if (config.onConfirm) {
      setIsLoading(true);
      try {
        await config.onConfirm();
      } finally {
        setIsLoading(false);
      }
    }
    close();
  }, [config, close]);

  const cancel = useCallback(() => {
    config.onCancel?.();
    close();
  }, [config, close]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      cancel();
    }
  }, [cancel]);

  const dialogProps = useMemo(() => ({
    open: isOpen,
    onOpenChange: handleOpenChange,
  }), [isOpen, handleOpenChange]);

  return {
    isOpen,
    title,
    description,
    confirmText,
    cancelText,
    destructive,
    isLoading,
    open,
    close,
    confirm,
    cancel,
    dialogProps,
  };
}

// ============================================================================
// useMultiStepModal Hook
// ============================================================================

export interface UseMultiStepModalOptions<T = undefined> {
  /** Total number of steps */
  totalSteps: number;
  /** Initial step (0-indexed) */
  initialStep?: number;
  /** Called when modal opens */
  onOpen?: (data?: T) => void;
  /** Called when modal closes */
  onClose?: () => void;
  /** Called on step change */
  onStepChange?: (step: number) => void;
  /** Called on complete (last step next) */
  onComplete?: (data?: T) => void;
}

export interface UseMultiStepModalReturn<T = undefined> {
  isOpen: boolean;
  data: T | undefined;
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: number;
  open: (data?: T) => void;
  close: () => void;
  next: () => void;
  previous: () => void;
  goToStep: (step: number) => void;
  reset: () => void;
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
}

export function useMultiStepModal<T = undefined>(
  options: UseMultiStepModalOptions<T>
): UseMultiStepModalReturn<T> {
  const {
    totalSteps,
    initialStep = 0,
    onOpen,
    onClose,
    onStepChange,
    onComplete,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | undefined>(undefined);
  const [currentStep, setCurrentStep] = useState(initialStep);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const open = useCallback((modalData?: T) => {
    setData(modalData);
    setCurrentStep(initialStep);
    setIsOpen(true);
    onOpen?.(modalData);
  }, [initialStep, onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(undefined);
    setCurrentStep(initialStep);
    onClose?.();
  }, [initialStep, onClose]);

  const goToStep = useCallback((step: number) => {
    const clampedStep = Math.max(0, Math.min(step, totalSteps - 1));
    setCurrentStep(clampedStep);
    onStepChange?.(clampedStep);
  }, [totalSteps, onStepChange]);

  const next = useCallback(() => {
    if (isLastStep) {
      onComplete?.(data);
      close();
    } else {
      goToStep(currentStep + 1);
    }
  }, [isLastStep, currentStep, data, onComplete, close, goToStep]);

  const previous = useCallback(() => {
    if (!isFirstStep) {
      goToStep(currentStep - 1);
    }
  }, [isFirstStep, currentStep, goToStep]);

  const reset = useCallback(() => {
    setCurrentStep(initialStep);
  }, [initialStep]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      close();
    }
  }, [close]);

  const dialogProps = useMemo(() => ({
    open: isOpen,
    onOpenChange: handleOpenChange,
  }), [isOpen, handleOpenChange]);

  return {
    isOpen,
    data,
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    progress,
    open,
    close,
    next,
    previous,
    goToStep,
    reset,
    dialogProps,
  };
}

// ============================================================================
// useSheetModal Hook (for side panels/drawers)
// ============================================================================

export type SheetSide = "top" | "right" | "bottom" | "left";

export interface UseSheetModalOptions<T = undefined> extends UseModalOptions<T> {
  /** Default side */
  defaultSide?: SheetSide;
}

export interface UseSheetModalReturn<T = undefined> extends UseModalReturn<T> {
  /** Current side */
  side: SheetSide;
  /** Change side */
  setSide: (side: SheetSide) => void;
  /** Open with specific side */
  openSide: (side: SheetSide, data?: T) => void;
}

export function useSheetModal<T = undefined>(
  options: UseSheetModalOptions<T> = {}
): UseSheetModalReturn<T> {
  const { defaultSide = "right", ...modalOptions } = options;
  const modal = useModal<T>(modalOptions);
  const [side, setSide] = useState<SheetSide>(defaultSide);

  const openSide = useCallback((newSide: SheetSide, data?: T) => {
    setSide(newSide);
    modal.open(data);
  }, [modal]);

  return {
    ...modal,
    side,
    setSide,
    openSide,
  };
}

// ============================================================================
// useModalStack Hook (for stacked modals)
// ============================================================================

export interface ModalStackItem<T = unknown> {
  id: string;
  data?: T;
}

export interface UseModalStackReturn<T = unknown> {
  /** Current stack of modals */
  stack: ModalStackItem<T>[];
  /** Whether any modal is open */
  isOpen: boolean;
  /** Currently active modal */
  current: ModalStackItem<T> | undefined;
  /** Push a new modal onto stack */
  push: (id: string, data?: T) => void;
  /** Pop the top modal */
  pop: () => void;
  /** Close all modals */
  closeAll: () => void;
  /** Check if specific modal is open */
  isModalOpen: (id: string) => boolean;
}

export function useModalStack<T = unknown>(): UseModalStackReturn<T> {
  const [stack, setStack] = useState<ModalStackItem<T>[]>([]);

  const isOpen = stack.length > 0;
  const current = stack[stack.length - 1];

  const push = useCallback((id: string, data?: T) => {
    setStack((prev) => [...prev, { id, data }]);
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const closeAll = useCallback(() => {
    setStack([]);
  }, []);

  const isModalOpen = useCallback((id: string) => {
    return stack.some((item) => item.id === id);
  }, [stack]);

  return {
    stack,
    isOpen,
    current,
    push,
    pop,
    closeAll,
    isModalOpen,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useModal;
