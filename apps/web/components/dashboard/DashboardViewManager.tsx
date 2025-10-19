'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronDown, Plus, Edit, Trash2, Check } from 'lucide-react'
import { DashboardLayout } from '@/lib/dashboard/default-layouts'

interface DashboardView {
  id: string
  name: string
  layout: DashboardLayout
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

interface DashboardViewManagerProps {
  currentView: DashboardView | null
  onViewChange: (view: DashboardView) => void
  onViewSave: (name: string) => Promise<void>
  onViewDelete: (viewId: string) => Promise<void>
  onViewRename: (viewId: string, newName: string) => Promise<void>
}

export function DashboardViewManager({
  currentView,
  onViewChange,
  onViewSave,
  onViewDelete,
  onViewRename
}: DashboardViewManagerProps) {
  const [views, setViews] = useState<DashboardView[]>([])
  const [loading, setLoading] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [selectedView, setSelectedView] = useState<DashboardView | null>(null)

  useEffect(() => {
    loadViews()
  }, [])

  const loadViews = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dashboard/views')
      if (response.ok) {
        const { data } = await response.json()
        setViews(data || [])
      }
    } catch (error) {
      console.error('Failed to load dashboard views:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveView = async () => {
    if (!newViewName.trim()) return

    try {
      await onViewSave(newViewName)
      setSaveDialogOpen(false)
      setNewViewName('')
      await loadViews()
    } catch (error) {
      console.error('Failed to save view:', error)
    }
  }

  const handleRenameView = async () => {
    if (!selectedView || !newViewName.trim()) return

    try {
      await onViewRename(selectedView.id, newViewName)
      setRenameDialogOpen(false)
      setNewViewName('')
      setSelectedView(null)
      await loadViews()
    } catch (error) {
      console.error('Failed to rename view:', error)
    }
  }

  const handleDeleteView = async () => {
    if (!selectedView) return

    try {
      await onViewDelete(selectedView.id)
      setDeleteDialogOpen(false)
      setSelectedView(null)
      await loadViews()
    } catch (error) {
      console.error('Failed to delete view:', error)
    }
  }

  const openRenameDialog = (view: DashboardView) => {
    setSelectedView(view)
    setNewViewName(view.name)
    setRenameDialogOpen(true)
  }

  const openDeleteDialog = (view: DashboardView) => {
    setSelectedView(view)
    setDeleteDialogOpen(true)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[200px] justify-between">
              <span className="truncate">
                {currentView?.name || 'Select View'}
              </span>
              <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[250px]">
            {views.map(view => (
              <DropdownMenuItem
                key={view.id}
                className="flex items-center justify-between group"
                onClick={() => onViewChange(view)}
              >
                <div className="flex items-center gap-2 flex-1">
                  {currentView?.id === view.id && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="truncate">{view.name}</span>
                  {view.isDefault && (
                    <span className="text-xs text-gray-500">(Default)</span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      openRenameDialog(view)
                    }}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  {!view.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDeleteDialog(view)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Save Current View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Save View Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Dashboard View</DialogTitle>
            <DialogDescription>
              Give your current dashboard layout a name to save it for later use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                placeholder="e.g., Weekly Review, Executive Summary"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveView()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSaveDialogOpen(false)
                setNewViewName('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveView} disabled={!newViewName.trim()}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename View Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Dashboard View</DialogTitle>
            <DialogDescription>
              Enter a new name for this dashboard view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-view">View Name</Label>
              <Input
                id="rename-view"
                placeholder="Enter new name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameView()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false)
                setNewViewName('')
                setSelectedView(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameView} disabled={!newViewName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete View Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Dashboard View</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedView?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setSelectedView(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteView}>
              Delete View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default DashboardViewManager
