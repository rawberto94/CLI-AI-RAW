/**
 * State Machine Pattern
 * Type-safe finite state machines for complex UI flows
 * 
 * @example
 * // Define machine
 * const uploadMachine = createMachine({
 *   initial: 'idle',
 *   states: {
 *     idle: { on: { UPLOAD: 'uploading' } },
 *     uploading: { 
 *       on: { 
 *         SUCCESS: 'success', 
 *         FAILURE: 'error',
 *         CANCEL: 'idle',
 *       } 
 *     },
 *     success: { on: { RESET: 'idle' } },
 *     error: { on: { RETRY: 'uploading', RESET: 'idle' } },
 *   },
 * });
 * 
 * // Use in component
 * const { state, send, can } = useMachine(uploadMachine);
 * 
 * if (can('UPLOAD')) {
 *   send('UPLOAD');
 * }
 */

import { useState, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type StateValue = string;
export type EventType = string;

export interface StateNode<TContext = unknown> {
  /** Transitions from this state */
  on?: Record<EventType, StateValue | TransitionConfig<TContext>>;
  /** Entry actions */
  entry?: Action<TContext> | Action<TContext>[];
  /** Exit actions */
  exit?: Action<TContext> | Action<TContext>[];
  /** Is this a final state? */
  final?: boolean;
  /** Nested states */
  states?: Record<StateValue, StateNode<TContext>>;
  /** Initial nested state */
  initial?: StateValue;
}

export interface TransitionConfig<TContext = unknown> {
  target: StateValue;
  guard?: (context: TContext, event: MachineEvent) => boolean;
  actions?: Action<TContext> | Action<TContext>[];
}

export interface MachineConfig<TContext = unknown> {
  /** Unique machine ID */
  id?: string;
  /** Initial state */
  initial: StateValue;
  /** Initial context */
  context?: TContext;
  /** State definitions */
  states: Record<StateValue, StateNode<TContext>>;
  /** Actions available to the machine */
  actions?: Record<string, ActionFunction<TContext>>;
  /** Guards available to the machine */
  guards?: Record<string, GuardFunction<TContext>>;
}

export interface MachineEvent {
  type: EventType;
  [key: string]: unknown;
}

export type Action<TContext = unknown> = 
  | string 
  | ActionFunction<TContext>;

export type ActionFunction<TContext = unknown> = (
  context: TContext,
  event: MachineEvent
) => void | TContext | Partial<TContext>;

export type GuardFunction<TContext = unknown> = (
  context: TContext,
  event: MachineEvent
) => boolean;

export interface MachineState<TContext = unknown> {
  value: StateValue;
  context: TContext;
  event?: MachineEvent;
  history: StateValue[];
}

export interface Machine<TContext = unknown> {
  config: MachineConfig<TContext>;
  initialState: MachineState<TContext>;
  transition: (
    state: MachineState<TContext>,
    event: MachineEvent | EventType
  ) => MachineState<TContext>;
  getNextStates: (state: StateValue) => EventType[];
  canTransition: (state: StateValue, event: EventType) => boolean;
}

// ============================================================================
// Machine Creation
// ============================================================================

/**
 * Create a state machine
 */
export function createMachine<TContext = unknown>(
  config: MachineConfig<TContext>
): Machine<TContext> {
  const initialContext = (config.context ?? {}) as TContext;
  
  const initialState: MachineState<TContext> = {
    value: config.initial,
    context: initialContext,
    history: [],
  };

  /**
   * Get state node for a given state value
   */
  function getStateNode(stateValue: StateValue): StateNode<TContext> | undefined {
    // Handle nested states with dot notation
    const parts = stateValue.split('.');
    const firstPart = parts[0];
    if (!firstPart) return undefined;
    
    let current: StateNode<TContext> | undefined = config.states[firstPart];
    
    for (let i = 1; i < parts.length && current?.states; i++) {
      const part = parts[i];
      if (part) {
        current = current.states[part];
      }
    }
    
    return current;
  }

  /**
   * Execute actions
   */
  function executeActions(
    actions: Action<TContext> | Action<TContext>[] | undefined,
    context: TContext,
    event: MachineEvent
  ): TContext {
    if (!actions) return context;
    
    const actionList = Array.isArray(actions) ? actions : [actions];
    let newContext = context;

    for (const action of actionList) {
      if (typeof action === 'string') {
        const actionFn = config.actions?.[action];
        if (actionFn) {
          const result = actionFn(newContext, event);
          if (result && typeof result === 'object') {
            newContext = { ...newContext, ...result };
          }
        }
      } else {
        const result = action(newContext, event);
        if (result && typeof result === 'object') {
          newContext = { ...newContext, ...result };
        }
      }
    }

    return newContext;
  }

  /**
   * Check if a guard allows transition
   */
  function checkGuard(
    guard: string | GuardFunction<TContext> | undefined,
    context: TContext,
    event: MachineEvent
  ): boolean {
    if (!guard) return true;

    if (typeof guard === 'string') {
      const guardFn = config.guards?.[guard];
      return guardFn ? guardFn(context, event) : true;
    }

    return guard(context, event);
  }

  /**
   * Transition to next state
   */
  function transition(
    state: MachineState<TContext>,
    eventOrType: MachineEvent | EventType
  ): MachineState<TContext> {
    const event: MachineEvent = typeof eventOrType === 'string'
      ? { type: eventOrType }
      : eventOrType;

    const stateNode = getStateNode(state.value);
    if (!stateNode) {
      console.warn(`State "${state.value}" not found`);
      return state;
    }

    const transitionDef = stateNode.on?.[event.type];
    if (!transitionDef) {
      // No transition defined for this event
      return state;
    }

    // Parse transition config
    let target: StateValue;
    let actions: Action<TContext> | Action<TContext>[] | undefined;
    let guard: string | GuardFunction<TContext> | undefined;

    if (typeof transitionDef === 'string') {
      target = transitionDef;
    } else {
      target = transitionDef.target;
      actions = transitionDef.actions;
      guard = transitionDef.guard;
    }

    // Check guard
    if (!checkGuard(guard, state.context, event)) {
      return state;
    }

    // Execute exit actions
    let newContext = executeActions(stateNode.exit, state.context, event);

    // Execute transition actions
    newContext = executeActions(actions, newContext, event);

    // Execute entry actions of new state
    const targetNode = getStateNode(target);
    if (targetNode) {
      newContext = executeActions(targetNode.entry, newContext, event);
    }

    return {
      value: target,
      context: newContext,
      event,
      history: [...state.history, state.value],
    };
  }

  /**
   * Get possible events from current state
   */
  function getNextStates(stateValue: StateValue): EventType[] {
    const stateNode = getStateNode(stateValue);
    return stateNode?.on ? Object.keys(stateNode.on) : [];
  }

  /**
   * Check if a transition is possible
   */
  function canTransition(stateValue: StateValue, eventType: EventType): boolean {
    const stateNode = getStateNode(stateValue);
    return !!stateNode?.on?.[eventType];
  }

  return {
    config,
    initialState,
    transition,
    getNextStates,
    canTransition,
  };
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseMachineReturn<TContext = unknown> {
  /** Current state value */
  state: StateValue;
  /** Current context */
  context: TContext;
  /** Full state object */
  machineState: MachineState<TContext>;
  /** Send an event */
  send: (event: MachineEvent | EventType) => void;
  /** Check if transition is possible */
  can: (event: EventType) => boolean;
  /** Get possible events */
  nextEvents: EventType[];
  /** Check if in specific state */
  matches: (state: StateValue) => boolean;
  /** Reset to initial state */
  reset: () => void;
}

/**
 * React hook for using a state machine
 */
export function useMachine<TContext = unknown>(
  machine: Machine<TContext>
): UseMachineReturn<TContext> {
  const [machineState, setMachineState] = useState<MachineState<TContext>>(
    machine.initialState
  );

  const send = useCallback(
    (event: MachineEvent | EventType) => {
      setMachineState(current => machine.transition(current, event));
    },
    [machine]
  );

  const can = useCallback(
    (eventType: EventType) => machine.canTransition(machineState.value, eventType),
    [machine, machineState.value]
  );

  const matches = useCallback(
    (state: StateValue) => machineState.value === state || machineState.value.startsWith(`${state}.`),
    [machineState.value]
  );

  const reset = useCallback(() => {
    setMachineState(machine.initialState);
  }, [machine]);

  const nextEvents = useMemo(
    () => machine.getNextStates(machineState.value),
    [machine, machineState.value]
  );

  return {
    state: machineState.value,
    context: machineState.context,
    machineState,
    send,
    can,
    nextEvents,
    matches,
    reset,
  };
}

// ============================================================================
// Common Machine Patterns
// ============================================================================

/**
 * Create a loading machine (idle -> loading -> success/error)
 */
export function createLoadingMachine<TData = unknown, TError = Error>() {
  type Context = {
    data: TData | null;
    error: TError | null;
  };

  return createMachine<Context>({
    id: 'loading',
    initial: 'idle',
    context: { data: null, error: null },
    states: {
      idle: {
        on: { FETCH: 'loading' },
      },
      loading: {
        on: {
          SUCCESS: {
            target: 'success',
            actions: (ctx, event) => ({ ...ctx, data: event.data as TData, error: null }),
          },
          FAILURE: {
            target: 'error',
            actions: (ctx, event) => ({ ...ctx, error: event.error as TError }),
          },
        },
      },
      success: {
        on: { 
          FETCH: 'loading',
          RESET: 'idle',
        },
      },
      error: {
        on: { 
          RETRY: 'loading',
          RESET: 'idle',
        },
      },
    },
  });
}

/**
 * Create an upload machine
 */
export function createUploadMachine() {
  type Context = {
    file: File | null;
    progress: number;
    error: string | null;
    result: unknown;
  };

  return createMachine<Context>({
    id: 'upload',
    initial: 'idle',
    context: { file: null, progress: 0, error: null, result: null },
    states: {
      idle: {
        on: {
          SELECT: {
            target: 'selected',
            actions: (ctx, event) => ({ ...ctx, file: event.file as File }),
          },
        },
      },
      selected: {
        on: {
          UPLOAD: 'uploading',
          CLEAR: {
            target: 'idle',
            actions: () => ({ file: null, progress: 0, error: null, result: null }),
          },
        },
      },
      uploading: {
        on: {
          PROGRESS: {
            target: 'uploading',
            actions: (ctx, event) => ({ ...ctx, progress: event.progress as number }),
          },
          SUCCESS: {
            target: 'success',
            actions: (ctx, event) => ({ ...ctx, progress: 100, result: event.result }),
          },
          FAILURE: {
            target: 'error',
            actions: (ctx, event) => ({ ...ctx, error: event.error as string }),
          },
          CANCEL: {
            target: 'selected',
            actions: (ctx) => ({ ...ctx, progress: 0 }),
          },
        },
      },
      success: {
        on: {
          RESET: {
            target: 'idle',
            actions: () => ({ file: null, progress: 0, error: null, result: null }),
          },
        },
      },
      error: {
        on: {
          RETRY: 'uploading',
          RESET: {
            target: 'idle',
            actions: () => ({ file: null, progress: 0, error: null, result: null }),
          },
        },
      },
    },
  });
}

/**
 * Create a form machine
 */
export function createFormMachine<TValues extends Record<string, unknown>>() {
  type Context = {
    values: TValues;
    errors: Partial<Record<keyof TValues, string>>;
    touched: Partial<Record<keyof TValues, boolean>>;
    isValid: boolean;
  };

  return createMachine<Context>({
    id: 'form',
    initial: 'editing',
    context: {
      values: {} as TValues,
      errors: {},
      touched: {},
      isValid: false,
    },
    states: {
      editing: {
        on: {
          CHANGE: {
            target: 'editing',
            actions: (ctx, event) => ({
              ...ctx,
              values: { ...ctx.values, [event.field as string]: event.value },
            }),
          },
          BLUR: {
            target: 'editing',
            actions: (ctx, event) => ({
              ...ctx,
              touched: { ...ctx.touched, [event.field as string]: true },
            }),
          },
          VALIDATE: {
            target: 'validating',
          },
          SUBMIT: 'submitting',
        },
      },
      validating: {
        on: {
          VALID: {
            target: 'editing',
            actions: (ctx) => ({ ...ctx, errors: {}, isValid: true }),
          },
          INVALID: {
            target: 'editing',
            actions: (ctx, event) => ({
              ...ctx,
              errors: event.errors as Context['errors'],
              isValid: false,
            }),
          },
        },
      },
      submitting: {
        on: {
          SUCCESS: 'success',
          FAILURE: {
            target: 'editing',
            actions: (ctx, event) => ({
              ...ctx,
              errors: { _form: event.error as string } as Context['errors'],
            }),
          },
        },
      },
      success: {
        final: true,
        on: {
          RESET: {
            target: 'editing',
            actions: () => ({
              values: {} as TValues,
              errors: {},
              touched: {},
              isValid: false,
            }),
          },
        },
      },
    },
  });
}

/**
 * Create a wizard/multi-step machine
 */
export function createWizardMachine(steps: string[]) {
  const states: Record<string, StateNode> = {};

  steps.forEach((step, index) => {
    const isFirst = index === 0;
    const isLast = index === steps.length - 1;
    const nextStep = steps[index + 1];
    const prevStep = steps[index - 1];

    states[step] = {
      on: {
        ...(isLast || !nextStep ? {} : { NEXT: nextStep }),
        ...(isFirst || !prevStep ? {} : { BACK: prevStep }),
        ...(isLast ? { COMPLETE: 'complete' } : {}),
      },
    };
  });

  states['complete'] = { final: true };

  const firstStep = steps[0];
  if (!firstStep) {
    throw new Error('createWizardMachine requires at least one step');
  }

  return createMachine({
    id: 'wizard',
    initial: firstStep,
    context: { currentStep: 0, totalSteps: steps.length },
    states,
  });
}
