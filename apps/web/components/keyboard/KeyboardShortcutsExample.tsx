/**
 * Keyboard Shortcuts Example
 * Demonstrates how to use keyboard shortcuts in a page
 */

'use client';

import React, { useState } from 'react';
import { usePageShortcuts, createSaveShortcut, createCancelShortcut } from './GlobalKeyboardShortcuts';
import { useFeedback } from '@/components/feedback/FeedbackSystem';
import { ShortcutIndicator } from './KeyboardShortcutsModal';
import { Save, X, Edit, Trash2, Copy } from 'lucide-react';

export function KeyboardShortcutsExample() {
  const feedback = useFeedback();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('Sample content');

  // Define handlers first
  const handleSave = () => {
    feedback.showSuccess('Saved', 'Your changes have been saved successfully');
    setIsEditing(false);
  };

  const handleCancel = () => {
    feedback.showInfo('Cancelled', 'Changes discarded');
    setIsEditing(false);
  };

  const handleDelete = () => {
    feedback.showWarning('Delete', 'Are you sure you want to delete this?');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    feedback.showSuccess('Copied', 'Content copied to clipboard');
  };

  // Define page-specific shortcuts
  usePageShortcuts([
    createSaveShortcut(() => {
      if (isEditing) {
        handleSave();
      }
    }),
    createCancelShortcut(() => {
      if (isEditing) {
        handleCancel();
      }
    }),
    {
      key: 'e',
      ctrl: true,
      description: 'Edit content',
      action: () => setIsEditing(true),
      category: 'Editing',
      enabled: !isEditing,
    },
    {
      key: 'd',
      ctrl: true,
      shift: true,
      description: 'Delete content',
      action: handleDelete,
      category: 'Actions',
    },
    {
      key: 'c',
      ctrl: true,
      shift: true,
      description: 'Copy content',
      action: handleCopy,
      category: 'Actions',
    },
  ]);

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2">Keyboard Shortcuts Demo</h2>
        <p className="text-blue-100">
          Try using keyboard shortcuts to interact with this page. Press <kbd className="px-2 py-1 bg-white/20 rounded">?</kbd> to see all available shortcuts.
        </p>
      </div>

      {/* Content Editor */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Content Editor</h3>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <ShortcutIndicator
                  shortcut={{
                    key: 'e',
                    ctrl: true,
                    description: 'Edit',
                    action: () => {},
                  }}
                >
                  <button
                    onClick={() => setIsEditing(true)}
                    data-edit-button
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                </ShortcutIndicator>

                <ShortcutIndicator
                  shortcut={{
                    key: 'c',
                    ctrl: true,
                    shift: true,
                    description: 'Copy',
                    action: () => {},
                  }}
                >
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </ShortcutIndicator>

                <ShortcutIndicator
                  shortcut={{
                    key: 'd',
                    ctrl: true,
                    shift: true,
                    description: 'Delete',
                    action: () => {},
                  }}
                >
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </ShortcutIndicator>
              </>
            ) : (
              <>
                <ShortcutIndicator
                  shortcut={{
                    key: 's',
                    ctrl: true,
                    description: 'Save',
                    action: () => {},
                  }}
                >
                  <button
                    onClick={handleSave}
                    data-save-button
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                </ShortcutIndicator>

                <ShortcutIndicator
                  shortcut={{
                    key: 'Escape',
                    description: 'Cancel',
                    action: () => {},
                  }}
                >
                  <button
                    onClick={handleCancel}
                    data-close-button
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </ShortcutIndicator>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter content..."
          />
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-700">{content}</p>
          </div>
        )}
      </div>

      {/* Shortcuts Reference */}
      <div className="border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">Available Shortcuts on This Page</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ShortcutItem shortcut="Ctrl + E" description="Edit content" />
          <ShortcutItem shortcut="Ctrl + S" description="Save changes" />
          <ShortcutItem shortcut="Escape" description="Cancel editing" />
          <ShortcutItem shortcut="Ctrl + Shift + C" description="Copy content" />
          <ShortcutItem shortcut="Ctrl + Shift + D" description="Delete content" />
          <ShortcutItem shortcut="?" description="Show all shortcuts" />
        </div>
      </div>

      {/* Global Shortcuts Reference */}
      <div className="border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">Global Shortcuts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ShortcutItem shortcut="Ctrl + H" description="Go to home" />
          <ShortcutItem shortcut="Ctrl + Shift + C" description="Go to contracts" />
          <ShortcutItem shortcut="Ctrl + Shift + R" description="Go to rate cards" />
          <ShortcutItem shortcut="Ctrl + Shift + A" description="Go to analytics" />
          <ShortcutItem shortcut="Ctrl + K" description="Open command palette" />
          <ShortcutItem shortcut="/" description="Focus search" />
          <ShortcutItem shortcut="Ctrl + /" description="Open AI Assistant" />
        </div>
      </div>
    </div>
  );
}

function ShortcutItem({ shortcut, description }: { shortcut: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-700">{description}</span>
      <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono text-gray-900">
        {shortcut}
      </kbd>
    </div>
  );
}
