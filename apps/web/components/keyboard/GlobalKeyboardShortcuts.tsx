/**
 * Global Keyboard Shortcuts Provider
 * Provides application-wide keyboard shortcuts
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { useFeedback } from '@/components/feedback/FeedbackSystem';
import { CommandPalette } from '@/components/ui/command-palette';

export function GlobalKeyboardShortcuts({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Listen for custom event to open shortcuts modal
  useEffect(() => {
    const handleOpenShortcuts = () => setShowShortcutsModal(true);
    window.addEventListener('openKeyboardShortcuts', handleOpenShortcuts);
    return () => window.removeEventListener('openKeyboardShortcuts', handleOpenShortcuts);
  }, []);

  // Define global shortcuts
  const shortcuts: KeyboardShortcut[] = [
    // Help & Navigation
    {
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      action: () => setShowShortcutsModal(true),
      category: 'Help',
    },
    {
      key: 'h',
      ctrl: true,
      description: 'Go to home',
      action: () => router.push('/'),
      category: 'Navigation',
    },
    {
      key: 'c',
      ctrl: true,
      shift: true,
      description: 'Go to contracts',
      action: () => router.push('/contracts'),
      category: 'Navigation',
    },
    {
      key: 'r',
      ctrl: true,
      shift: true,
      description: 'Go to rate cards',
      action: () => router.push('/rate-cards'),
      category: 'Navigation',
    },
    {
      key: 'a',
      ctrl: true,
      shift: true,
      description: 'Go to analytics',
      action: () => router.push('/analytics'),
      category: 'Navigation',
    },
    {
      key: 'u',
      ctrl: true,
      shift: true,
      description: 'Go to upload',
      action: () => router.push('/upload'),
      category: 'Navigation',
    },

    // Search
    {
      key: 'k',
      ctrl: true,
      description: 'Open command palette',
      action: () => {
        setIsCommandPaletteOpen(prev => !prev);
      },
      category: 'Actions',
    },
    {
      key: '/',
      ctrl: true,
      description: 'Open AI Assistant',
      action: () => {
        window.dispatchEvent(new CustomEvent('openAIChatbot'));
      },
      category: 'Actions',
    },
    {
      key: '/',
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      category: 'Search',
    },

    // Actions
    {
      key: 'n',
      ctrl: true,
      description: 'New item',
      action: () => {
        feedback.showInfo('New Item', 'Create new item shortcut triggered');
      },
      category: 'Actions',
    },
    {
      key: 's',
      ctrl: true,
      description: 'Save',
      action: () => {
        const saveButton = document.querySelector('[data-save-button]') as HTMLButtonElement;
        if (saveButton) {
          saveButton.click();
        } else {
          feedback.showInfo('Save', 'Nothing to save on this page');
        }
      },
      category: 'Actions',
    },
    {
      key: 'Escape',
      description: 'Cancel / Close',
      action: () => {
        const closeButton = document.querySelector('[data-close-button]') as HTMLButtonElement;
        if (closeButton) {
          closeButton.click();
        }
      },
      category: 'Actions',
    },

    // Editing
    {
      key: 'e',
      ctrl: true,
      description: 'Edit current item',
      action: () => {
        const editButton = document.querySelector('[data-edit-button]') as HTMLButtonElement;
        if (editButton) {
          editButton.click();
        }
      },
      category: 'Editing',
    },
    {
      key: 'd',
      ctrl: true,
      description: 'Duplicate current item',
      action: () => {
        const duplicateButton = document.querySelector('[data-duplicate-button]') as HTMLButtonElement;
        if (duplicateButton) {
          duplicateButton.click();
        }
      },
      category: 'Editing',
    },

    // View
    {
      key: 'f',
      ctrl: true,
      description: 'Toggle fullscreen',
      action: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      },
      category: 'View',
    },
    {
      key: 'b',
      ctrl: true,
      description: 'Toggle sidebar',
      action: () => {
        const sidebarToggle = document.querySelector('[data-sidebar-toggle]') as HTMLButtonElement;
        if (sidebarToggle) {
          sidebarToggle.click();
        }
      },
      category: 'View',
    },

    // Refresh
    {
      key: 'r',
      ctrl: true,
      description: 'Refresh data',
      action: () => {
        const refreshButton = document.querySelector('[data-refresh-button]') as HTMLButtonElement;
        if (refreshButton) {
          refreshButton.click();
        } else {
          window.location.reload();
        }
      },
      category: 'Actions',
    },
  ];

  useKeyboardShortcuts({
    shortcuts,
    preventDefault: true,
    enableInInputs: false,
  });

  return (
    <>
      {children}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        shortcuts={shortcuts}
      />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </>
  );
}

// ============================================================================
// Page-specific Shortcuts Hook
// ============================================================================

export function usePageShortcuts(shortcuts: KeyboardShortcut[]) {
  useKeyboardShortcuts({
    shortcuts,
    preventDefault: true,
    enableInInputs: false,
  });
}

// ============================================================================
// Common Shortcut Patterns
// ============================================================================

export const createSaveShortcut = (onSave: () => void): KeyboardShortcut => ({
  key: 's',
  ctrl: true,
  description: 'Save changes',
  action: onSave,
  category: 'Actions',
});

export const createCancelShortcut = (onCancel: () => void): KeyboardShortcut => ({
  key: 'Escape',
  description: 'Cancel',
  action: onCancel,
  category: 'Actions',
});

export const createDeleteShortcut = (onDelete: () => void): KeyboardShortcut => ({
  key: 'Delete',
  description: 'Delete item',
  action: onDelete,
  category: 'Actions',
});

export const createNavigationShortcuts = (
  onPrevious: () => void,
  onNext: () => void
): KeyboardShortcut[] => [
  {
    key: 'ArrowLeft',
    ctrl: true,
    description: 'Previous item',
    action: onPrevious,
    category: 'Navigation',
  },
  {
    key: 'ArrowRight',
    ctrl: true,
    description: 'Next item',
    action: onNext,
    category: 'Navigation',
  },
];

export const createSearchShortcut = (onSearch: () => void): KeyboardShortcut => ({
  key: 'f',
  ctrl: true,
  description: 'Search',
  action: onSearch,
  category: 'Search',
});
