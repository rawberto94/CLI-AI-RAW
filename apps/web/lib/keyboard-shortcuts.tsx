/**
 * Keyboard Shortcuts System
 * Global and context-aware keyboard shortcuts
 * 
 * @example
 * import { useHotkeys, HotkeyProvider, useHotkeyContext } from '@/lib/keyboard-shortcuts';
 * 
 * // Global shortcut
 * useHotkeys('ctrl+k', () => openCommandPalette());
 * 
 * // Scoped shortcut
 * useHotkeys('escape', () => closeModal(), { scope: 'modal' });
 */

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  ReactNode,
} from 'react';

// ============================================================================
// Types
// ============================================================================

export interface HotkeyConfig {
  /**
   * Key combination (e.g., 'ctrl+k', 'shift+enter', 'escape')
   */
  keys: string;
  /**
   * Handler function
   */
  handler: (event: KeyboardEvent) => void;
  /**
   * Description for help display
   */
  description?: string;
  /**
   * Scope for context-aware shortcuts
   */
  scope?: string;
  /**
   * Whether to prevent default behavior
   */
  preventDefault?: boolean;
  /**
   * Whether to stop propagation
   */
  stopPropagation?: boolean;
  /**
   * Only trigger when target is input/textarea
   */
  enableOnInput?: boolean;
  /**
   * Only trigger when target is contenteditable
   */
  enableOnContentEditable?: boolean;
  /**
   * Whether the shortcut is enabled
   */
  enabled?: boolean;
}

export interface ParsedKey {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface HotkeyGroup {
  name: string;
  shortcuts: Array<{
    keys: string;
    description: string;
  }>;
}

// ============================================================================
// Key Parsing
// ============================================================================

const KEY_ALIASES: Record<string, string> = {
  'esc': 'escape',
  'del': 'delete',
  'ins': 'insert',
  'pgup': 'pageup',
  'pgdn': 'pagedown',
  'return': 'enter',
  'up': 'arrowup',
  'down': 'arrowdown',
  'left': 'arrowleft',
  'right': 'arrowright',
  'space': ' ',
  'spacebar': ' ',
  'plus': '+',
  'minus': '-',
};

const MODIFIER_KEYS = ['ctrl', 'alt', 'shift', 'meta', 'mod'];

function normalizeKey(key: string): string {
  const lower = key.toLowerCase();
  return KEY_ALIASES[lower] || lower;
}

export function parseKeyCombo(combo: string): ParsedKey {
  const parts = combo.toLowerCase().split('+').map(p => p.trim());
  
  const result: ParsedKey = {
    key: '',
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') {
      result.ctrl = true;
    } else if (part === 'alt' || part === 'option') {
      result.alt = true;
    } else if (part === 'shift') {
      result.shift = true;
    } else if (part === 'meta' || part === 'cmd' || part === 'command' || part === 'win') {
      result.meta = true;
    } else if (part === 'mod') {
      // 'mod' is meta on Mac, ctrl elsewhere
      if (typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)) {
        result.meta = true;
      } else {
        result.ctrl = true;
      }
    } else {
      result.key = normalizeKey(part);
    }
  }

  return result;
}

function matchesKeyCombo(event: KeyboardEvent, parsed: ParsedKey): boolean {
  const eventKey = event.key.toLowerCase();
  const normalizedEventKey = normalizeKey(eventKey);

  return (
    normalizedEventKey === parsed.key &&
    event.ctrlKey === parsed.ctrl &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift &&
    event.metaKey === parsed.meta
  );
}

// ============================================================================
// Context
// ============================================================================

interface HotkeyContextValue {
  registerHotkey: (config: HotkeyConfig) => () => void;
  unregisterHotkey: (keys: string, scope?: string) => void;
  enableScope: (scope: string) => void;
  disableScope: (scope: string) => void;
  getActiveScopes: () => string[];
  getAllHotkeys: () => HotkeyGroup[];
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const HotkeyContext = createContext<HotkeyContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface HotkeyProviderProps {
  children: ReactNode;
  /**
   * Default scopes to enable
   */
  defaultScopes?: string[];
  /**
   * Whether to enable hotkeys by default
   */
  defaultEnabled?: boolean;
}

export function HotkeyProvider({
  children,
  defaultScopes = ['global'],
  defaultEnabled = true,
}: HotkeyProviderProps) {
  const hotkeysRef = useRef<Map<string, HotkeyConfig>>(new Map());
  const [activeScopes, setActiveScopes] = useState<Set<string>>(new Set(defaultScopes));
  const [isEnabled, setEnabled] = useState(defaultEnabled);

  const getHotkeyKey = (keys: string, scope = 'global') => `${scope}:${keys}`;

  const registerHotkey = useCallback((config: HotkeyConfig): (() => void) => {
    const key = getHotkeyKey(config.keys, config.scope);
    hotkeysRef.current.set(key, {
      ...config,
      scope: config.scope || 'global',
      enabled: config.enabled ?? true,
    });

    return () => {
      hotkeysRef.current.delete(key);
    };
  }, []);

  const unregisterHotkey = useCallback((keys: string, scope = 'global') => {
    const key = getHotkeyKey(keys, scope);
    hotkeysRef.current.delete(key);
  }, []);

  const enableScope = useCallback((scope: string) => {
    setActiveScopes(prev => new Set([...prev, scope]));
  }, []);

  const disableScope = useCallback((scope: string) => {
    setActiveScopes(prev => {
      const next = new Set(prev);
      next.delete(scope);
      return next;
    });
  }, []);

  const getActiveScopes = useCallback(() => {
    return Array.from(activeScopes);
  }, [activeScopes]);

  const getAllHotkeys = useCallback((): HotkeyGroup[] => {
    const groups = new Map<string, HotkeyGroup>();

    for (const [, config] of hotkeysRef.current) {
      const scope = config.scope || 'global';
      if (!groups.has(scope)) {
        groups.set(scope, { name: scope, shortcuts: [] });
      }
      
      if (config.description) {
        groups.get(scope)!.shortcuts.push({
          keys: config.keys,
          description: config.description,
        });
      }
    }

    return Array.from(groups.values());
  }, []);

  // Global keyboard event listener
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if target is input/textarea/contenteditable (unless explicitly enabled)
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isContentEditable = target.isContentEditable;

      for (const [, config] of hotkeysRef.current) {
        // Check if scope is active
        if (!activeScopes.has(config.scope || 'global')) continue;

        // Check if enabled
        if (config.enabled === false) continue;

        // Check input restrictions
        if (isInput && !config.enableOnInput) continue;
        if (isContentEditable && !config.enableOnContentEditable) continue;

        // Check key match
        const parsed = parseKeyCombo(config.keys);
        if (matchesKeyCombo(event, parsed)) {
          if (config.preventDefault !== false) {
            event.preventDefault();
          }
          if (config.stopPropagation) {
            event.stopPropagation();
          }
          config.handler(event);
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEnabled, activeScopes]);

  const value: HotkeyContextValue = {
    registerHotkey,
    unregisterHotkey,
    enableScope,
    disableScope,
    getActiveScopes,
    getAllHotkeys,
    isEnabled,
    setEnabled,
  };

  return (
    <HotkeyContext.Provider value={value}>
      {children}
    </HotkeyContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useHotkeyContext(): HotkeyContextValue {
  const context = useContext(HotkeyContext);
  if (!context) {
    throw new Error('useHotkeyContext must be used within HotkeyProvider');
  }
  return context;
}

export interface UseHotkeysOptions {
  /**
   * Scope for the shortcut
   */
  scope?: string;
  /**
   * Description for help display
   */
  description?: string;
  /**
   * Whether to prevent default
   */
  preventDefault?: boolean;
  /**
   * Whether to stop propagation
   */
  stopPropagation?: boolean;
  /**
   * Enable on input elements
   */
  enableOnInput?: boolean;
  /**
   * Enable on contenteditable
   */
  enableOnContentEditable?: boolean;
  /**
   * Whether the shortcut is enabled
   */
  enabled?: boolean;
  /**
   * Dependencies to re-register
   */
  deps?: React.DependencyList;
}

/**
 * Hook to register a keyboard shortcut
 */
export function useHotkeys(
  keys: string,
  handler: (event: KeyboardEvent) => void,
  options: UseHotkeysOptions = {}
) {
  const context = useContext(HotkeyContext);
  const { deps = [], ...config } = options;
  
  // Stable handler ref
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    // If no context, set up standalone listener
    if (!context) {
      const parsed = parseKeyCombo(keys);
      
      const listener = (event: KeyboardEvent) => {
        if (options.enabled === false) return;
        
        const target = event.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        const isContentEditable = target.isContentEditable;
        
        if (isInput && !options.enableOnInput) return;
        if (isContentEditable && !options.enableOnContentEditable) return;
        
        if (matchesKeyCombo(event, parsed)) {
          if (options.preventDefault !== false) {
            event.preventDefault();
          }
          if (options.stopPropagation) {
            event.stopPropagation();
          }
          handlerRef.current(event);
        }
      };

      document.addEventListener('keydown', listener);
      return () => document.removeEventListener('keydown', listener);
    }

    // Use context-based registration
    return context.registerHotkey({
      keys,
      handler: (e) => handlerRef.current(e),
      ...config,
    });
  
  }, [keys, context, config.scope, config.enabled, ...deps]);
}

/**
 * Hook to manage a hotkey scope
 */
export function useHotkeyScope(scope: string, enabled = true) {
  const context = useContext(HotkeyContext);

  useEffect(() => {
    if (!context) return;
    
    if (enabled) {
      context.enableScope(scope);
    } else {
      context.disableScope(scope);
    }

    return () => {
      context.disableScope(scope);
    };
  }, [context, scope, enabled]);
}

// ============================================================================
// Common Shortcuts
// ============================================================================

export const commonShortcuts = {
  // Navigation
  search: 'mod+k',
  home: 'mod+shift+h',
  settings: 'mod+,',
  help: 'mod+/',
  
  // Actions
  save: 'mod+s',
  new: 'mod+n',
  delete: 'mod+backspace',
  duplicate: 'mod+d',
  
  // Selection
  selectAll: 'mod+a',
  
  // Editing
  undo: 'mod+z',
  redo: 'mod+shift+z',
  cut: 'mod+x',
  copy: 'mod+c',
  paste: 'mod+v',
  
  // UI
  escape: 'escape',
  enter: 'enter',
  tab: 'tab',
};

// ============================================================================
// Hotkey Display Component
// ============================================================================

export function HotkeyDisplay({ keys, className = '' }: { keys: string; className?: string }) {
  const parsed = parseKeyCombo(keys);
  const parts: string[] = [];

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  if (parsed.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (parsed.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (parsed.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (parsed.meta) parts.push(isMac ? '⌘' : 'Win');
  
  // Format key
  let displayKey = parsed.key.charAt(0).toUpperCase() + parsed.key.slice(1);
  if (displayKey === 'Arrowup') displayKey = '↑';
  if (displayKey === 'Arrowdown') displayKey = '↓';
  if (displayKey === 'Arrowleft') displayKey = '←';
  if (displayKey === 'Arrowright') displayKey = '→';
  if (displayKey === 'Enter') displayKey = isMac ? '↵' : 'Enter';
  if (displayKey === 'Backspace') displayKey = isMac ? '⌫' : 'Backspace';
  if (displayKey === 'Escape') displayKey = 'Esc';
  if (displayKey === ' ') displayKey = 'Space';
  
  parts.push(displayKey);

  return (
    <kbd className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded ${className}`}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-400">+</span>}
          <span>{part}</span>
        </React.Fragment>
      ))}
    </kbd>
  );
}

// ============================================================================
// Hotkey Help Dialog
// ============================================================================

export function HotkeyHelpList({ className = '' }: { className?: string }) {
  const context = useContext(HotkeyContext);
  
  if (!context) {
    return <div>No hotkey context available</div>;
  }

  const groups = context.getAllHotkeys();

  if (groups.length === 0) {
    return <div className="text-gray-500">No shortcuts registered</div>;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {groups.map(group => (
        <div key={group.name}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 capitalize">
            {group.name}
          </h3>
          <div className="space-y-2">
            {group.shortcuts.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {shortcut.description}
                </span>
                <HotkeyDisplay keys={shortcut.keys} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
