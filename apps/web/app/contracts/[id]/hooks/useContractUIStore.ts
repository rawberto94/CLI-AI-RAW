'use client'

import { create } from 'zustand'
import type { TabValue } from '../types'

interface ContractUIState {
  // Tab & PDF
  activeTab: TabValue
  showPdfViewer: boolean

  // Dialogs
  showShareDialog: boolean
  showComparison: boolean
  showCategorySelector: boolean
  showReminderDialog: boolean
  showUploadSignedDialog: boolean
  showExtendDialog: boolean
  showCommandPalette: boolean

  // Edit mode
  isEditing: boolean

  // Favorite (optimistic)
  isFavorite: boolean

  // Actions
  setActiveTab: (tab: TabValue) => void
  setShowPdfViewer: (open: boolean) => void
  togglePdfViewer: () => void
  openDialog: (dialog: DialogKey) => void
  closeDialog: (dialog: DialogKey) => void
  setIsEditing: (editing: boolean) => void
  setIsFavorite: (fav: boolean) => void
  toggleFavorite: () => void
  reset: () => void
}

type DialogKey =
  | 'share'
  | 'comparison'
  | 'categorySelector'
  | 'reminder'
  | 'uploadSigned'
  | 'extend'
  | 'commandPalette'

const dialogFieldMap: Record<DialogKey, keyof ContractUIState> = {
  share: 'showShareDialog',
  comparison: 'showComparison',
  categorySelector: 'showCategorySelector',
  reminder: 'showReminderDialog',
  uploadSigned: 'showUploadSignedDialog',
  extend: 'showExtendDialog',
  commandPalette: 'showCommandPalette',
}

const initialState = {
  activeTab: 'overview' as TabValue,
  showPdfViewer: false,
  showShareDialog: false,
  showComparison: false,
  showCategorySelector: false,
  showReminderDialog: false,
  showUploadSignedDialog: false,
  showExtendDialog: false,
  showCommandPalette: false,
  isEditing: false,
  isFavorite: false,
}

export const useContractUIStore = create<ContractUIState>((set) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setShowPdfViewer: (open) => set({ showPdfViewer: open }),
  togglePdfViewer: () => set((s) => ({ showPdfViewer: !s.showPdfViewer })),

  openDialog: (dialog) => set({ [dialogFieldMap[dialog]]: true }),
  closeDialog: (dialog) => set({ [dialogFieldMap[dialog]]: false }),

  setIsEditing: (editing) => set({ isEditing: editing }),
  setIsFavorite: (fav) => set({ isFavorite: fav }),
  toggleFavorite: () => set((s) => ({ isFavorite: !s.isFavorite })),

  reset: () => set(initialState),
}))
