"use client";

/**
 * useTabs Hook
 * 
 * State management for tabs, accordions, and similar navigation patterns.
 * Works with Radix UI Tabs component.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// ============================================================================
// Types
// ============================================================================

export interface UseTabsOptions<T extends string = string> {
  /** Default tab value */
  defaultValue: T;
  /** Tab values (for validation) */
  values?: T[];
  /** Callback when tab changes */
  onChange?: (value: T) => void;
  /** Sync with URL search params */
  syncWithUrl?: boolean;
  /** URL param name */
  urlParam?: string;
}

export interface UseTabsReturn<T extends string = string> {
  /** Current tab value */
  value: T;
  /** Set tab value */
  setValue: (value: T) => void;
  /** Check if tab is active */
  isActive: (tab: T) => boolean;
  /** Props for Tabs component */
  tabsProps: {
    value: T;
    onValueChange: (value: string) => void;
  };
  /** Go to next tab */
  next: () => void;
  /** Go to previous tab */
  previous: () => void;
  /** Reset to default */
  reset: () => void;
}

// ============================================================================
// useTabs Hook
// ============================================================================

export function useTabs<T extends string = string>(
  options: UseTabsOptions<T>
): UseTabsReturn<T> {
  const {
    defaultValue,
    values,
    onChange,
    syncWithUrl = false,
    urlParam = "tab",
  } = options;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get initial value from URL if syncing
  const getInitialValue = useCallback((): T => {
    if (syncWithUrl) {
      const urlValue = searchParams.get(urlParam) as T | null;
      if (urlValue && (!values || values.includes(urlValue))) {
        return urlValue;
      }
    }
    return defaultValue;
  }, [syncWithUrl, searchParams, urlParam, values, defaultValue]);

  const [value, setValueState] = useState<T>(getInitialValue);

  // Sync URL changes to state
  useEffect(() => {
    if (syncWithUrl) {
      const urlValue = searchParams.get(urlParam) as T | null;
      if (urlValue && urlValue !== value && (!values || values.includes(urlValue))) {
        setValueState(urlValue);
      }
    }
  }, [syncWithUrl, searchParams, urlParam, value, values]);

  const setValue = useCallback((newValue: T) => {
    // Validate if values array provided
    if (values && !values.includes(newValue)) {
      return;
    }

    setValueState(newValue);
    onChange?.(newValue);

    // Update URL if syncing
    if (syncWithUrl) {
      const params = new URLSearchParams(searchParams.toString());
      if (newValue === defaultValue) {
        params.delete(urlParam);
      } else {
        params.set(urlParam, newValue);
      }
      const queryString = params.toString();
      router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
    }
  }, [values, onChange, syncWithUrl, searchParams, urlParam, defaultValue, pathname, router]);

  const isActive = useCallback((tab: T) => value === tab, [value]);

  const tabsProps = useMemo(() => ({
    value,
    onValueChange: setValue as (value: string) => void,
  }), [value, setValue]);

  const next = useCallback(() => {
    if (!values || values.length === 0) return;
    const currentIndex = values.indexOf(value);
    const nextIndex = (currentIndex + 1) % values.length;
    const nextValue = values[nextIndex];
    if (nextValue !== undefined) {
      setValue(nextValue);
    }
  }, [values, value, setValue]);

  const previous = useCallback(() => {
    if (!values || values.length === 0) return;
    const currentIndex = values.indexOf(value);
    const prevIndex = currentIndex === 0 ? values.length - 1 : currentIndex - 1;
    const prevValue = values[prevIndex];
    if (prevValue !== undefined) {
      setValue(prevValue);
    }
  }, [values, value, setValue]);

  const reset = useCallback(() => {
    setValue(defaultValue);
  }, [defaultValue, setValue]);

  return {
    value,
    setValue,
    isActive,
    tabsProps,
    next,
    previous,
    reset,
  };
}

// ============================================================================
// useTabsWithHistory Hook
// ============================================================================

export interface UseTabsWithHistoryOptions<T extends string = string> extends UseTabsOptions<T> {
  /** Maximum history size */
  maxHistory?: number;
}

export interface UseTabsWithHistoryReturn<T extends string = string> extends UseTabsReturn<T> {
  /** Tab history */
  history: T[];
  /** Can go back */
  canGoBack: boolean;
  /** Go back to previous tab */
  goBack: () => void;
}

export function useTabsWithHistory<T extends string = string>(
  options: UseTabsWithHistoryOptions<T>
): UseTabsWithHistoryReturn<T> {
  const { maxHistory = 10, ...tabsOptions } = options;
  const tabs = useTabs(tabsOptions);
  const [history, setHistory] = useState<T[]>([tabs.value]);

  const setValue = useCallback((newValue: T) => {
    setHistory((prev) => {
      const newHistory = [...prev, newValue].slice(-maxHistory);
      return newHistory;
    });
    tabs.setValue(newValue);
  }, [tabs, maxHistory]);

  const canGoBack = history.length > 1;

  const goBack = useCallback(() => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      const previousTab = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      if (previousTab !== undefined) {
        tabs.setValue(previousTab);
      }
    }
  }, [history, tabs]);

  return {
    ...tabs,
    setValue,
    history,
    canGoBack,
    goBack,
  };
}

// ============================================================================
// useAccordion Hook
// ============================================================================

export type AccordionType = "single" | "multiple";

export interface UseAccordionOptions<T extends AccordionType = "single"> {
  /** Accordion type */
  type?: T;
  /** Default open item(s) */
  defaultValue?: T extends "single" ? string : string[];
  /** Callback when value changes */
  onChange?: T extends "single" ? (value: string) => void : (value: string[]) => void;
  /** Allow collapsing all (single mode) */
  collapsible?: boolean;
}

export interface UseAccordionReturn<T extends AccordionType = "single"> {
  /** Current value */
  value: T extends "single" ? string : string[];
  /** Set value */
  setValue: T extends "single" ? (value: string) => void : (value: string[]) => void;
  /** Check if item is open */
  isOpen: (item: string) => boolean;
  /** Toggle an item */
  toggle: (item: string) => void;
  /** Open an item */
  open: (item: string) => void;
  /** Close an item */
  close: (item: string) => void;
  /** Open all items (multiple mode) */
  openAll: (items: string[]) => void;
  /** Close all items */
  closeAll: () => void;
  /** Props for Accordion component */
  accordionProps: T extends "single"
    ? { type: "single"; value: string; onValueChange: (value: string) => void; collapsible?: boolean }
    : { type: "multiple"; value: string[]; onValueChange: (value: string[]) => void };
}

export function useAccordion<T extends AccordionType = "single">(
  options: UseAccordionOptions<T> = {} as UseAccordionOptions<T>
): UseAccordionReturn<T> {
  const {
    type = "single" as T,
    defaultValue,
    onChange,
    collapsible = true,
  } = options;

  const [value, setValueState] = useState<string | string[]>(() => {
    if (defaultValue !== undefined) return defaultValue;
    return type === "single" ? "" : [];
  });

  const setValue = useCallback((newValue: string | string[]) => {
    setValueState(newValue);
    if (onChange) {
      (onChange as (value: string | string[]) => void)(newValue);
    }
  }, [onChange]);

  const isOpen = useCallback((item: string) => {
    if (type === "single") {
      return value === item;
    }
    return (value as string[]).includes(item);
  }, [type, value]);

  const toggle = useCallback((item: string) => {
    if (type === "single") {
      if (value === item && collapsible) {
        setValue("");
      } else {
        setValue(item);
      }
    } else {
      const current = value as string[];
      if (current.includes(item)) {
        setValue(current.filter((i) => i !== item));
      } else {
        setValue([...current, item]);
      }
    }
  }, [type, value, collapsible, setValue]);

  const open = useCallback((item: string) => {
    if (type === "single") {
      setValue(item);
    } else {
      const current = value as string[];
      if (!current.includes(item)) {
        setValue([...current, item]);
      }
    }
  }, [type, value, setValue]);

  const close = useCallback((item: string) => {
    if (type === "single") {
      if (value === item) {
        setValue("");
      }
    } else {
      setValue((value as string[]).filter((i) => i !== item));
    }
  }, [type, value, setValue]);

  const openAll = useCallback((items: string[]) => {
    if (type === "multiple") {
      const current = value as string[];
      const newItems = items.filter((item) => !current.includes(item));
      setValue([...current, ...newItems]);
    }
  }, [type, value, setValue]);

  const closeAll = useCallback(() => {
    setValue(type === "single" ? "" : []);
  }, [type, setValue]);

  const accordionProps = useMemo(() => {
    if (type === "single") {
      return {
        type: "single" as const,
        value: value as string,
        onValueChange: setValue as (value: string) => void,
        collapsible,
      };
    }
    return {
      type: "multiple" as const,
      value: value as string[],
      onValueChange: setValue as (value: string[]) => void,
    };
  }, [type, value, setValue, collapsible]);

  return {
    value,
    setValue,
    isOpen,
    toggle,
    open,
    close,
    openAll,
    closeAll,
    accordionProps,
  } as UseAccordionReturn<T>;
}

// ============================================================================
// useSteps Hook (for wizard/stepper patterns)
// ============================================================================

export interface Step {
  id: string;
  label: string;
  description?: string;
  optional?: boolean;
}

export interface UseStepsOptions {
  /** Step definitions */
  steps: Step[];
  /** Initial step index */
  initialStep?: number;
  /** Callback on step change */
  onStepChange?: (step: number, stepData: Step) => void;
  /** Callback on completion */
  onComplete?: () => void;
  /** Linear mode (must complete steps in order) */
  linear?: boolean;
}

export interface UseStepsReturn {
  /** Current step index */
  currentStep: number;
  /** Current step data */
  currentStepData: Step | undefined;
  /** All steps */
  steps: Step[];
  /** Is first step */
  isFirst: boolean;
  /** Is last step */
  isLast: boolean;
  /** Progress percentage */
  progress: number;
  /** Go to next step */
  next: () => void;
  /** Go to previous step */
  previous: () => void;
  /** Go to specific step */
  goTo: (step: number) => void;
  /** Reset to first step */
  reset: () => void;
  /** Mark current step as complete and move to next */
  complete: () => void;
  /** Check if step is completed */
  isCompleted: (stepIndex: number) => boolean;
  /** Check if step is active */
  isActive: (stepIndex: number) => boolean;
  /** Check if step is accessible */
  isAccessible: (stepIndex: number) => boolean;
  /** Completed steps */
  completedSteps: number[];
}

export function useSteps(options: UseStepsOptions): UseStepsReturn {
  const {
    steps,
    initialStep = 0,
    onStepChange,
    onComplete,
    linear = true,
  } = options;

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const currentStepData = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const goTo = useCallback((step: number) => {
    const clampedStep = Math.max(0, Math.min(step, steps.length - 1));
    
    // In linear mode, can't skip to steps that aren't accessible
    if (linear && clampedStep > currentStep + 1) {
      return;
    }

    setCurrentStep(clampedStep);
    const stepData = steps[clampedStep];
    if (stepData !== undefined) {
      onStepChange?.(clampedStep, stepData);
    }
  }, [steps, linear, currentStep, onStepChange]);

  const next = useCallback(() => {
    if (!isLast) {
      goTo(currentStep + 1);
    }
  }, [isLast, currentStep, goTo]);

  const previous = useCallback(() => {
    if (!isFirst) {
      goTo(currentStep - 1);
    }
  }, [isFirst, currentStep, goTo]);

  const reset = useCallback(() => {
    setCurrentStep(initialStep);
    setCompletedSteps([]);
  }, [initialStep]);

  const complete = useCallback(() => {
    setCompletedSteps((prev) => {
      if (!prev.includes(currentStep)) {
        return [...prev, currentStep];
      }
      return prev;
    });

    if (isLast) {
      onComplete?.();
    } else {
      next();
    }
  }, [currentStep, isLast, onComplete, next]);

  const isCompleted = useCallback((stepIndex: number) => {
    return completedSteps.includes(stepIndex);
  }, [completedSteps]);

  const isActive = useCallback((stepIndex: number) => {
    return currentStep === stepIndex;
  }, [currentStep]);

  const isAccessible = useCallback((stepIndex: number) => {
    if (!linear) return true;
    // Can access current step, previous steps, or step right after highest completed
    const highestCompleted = Math.max(-1, ...completedSteps);
    return stepIndex <= highestCompleted + 1;
  }, [linear, completedSteps]);

  return {
    currentStep,
    currentStepData,
    steps,
    isFirst,
    isLast,
    progress,
    next,
    previous,
    goTo,
    reset,
    complete,
    isCompleted,
    isActive,
    isAccessible,
    completedSteps,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useTabs;
