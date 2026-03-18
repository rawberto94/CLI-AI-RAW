'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE_TIMES } from '@/lib/query-client'
import { getTenantId } from '@/lib/tenant'
import { toast } from 'sonner'
import type { ContractData, ContractVersion, ContractNote, HealthData } from '../types'

// ============================================================================
// Query Keys
// ============================================================================

export const contractKeys = {
  all: ['contracts'] as const,
  detail: (id: string) => ['contracts', id] as const,
  versions: (id: string) => ['contracts', id, 'versions'] as const,
  notes: (id: string) => ['contracts', id, 'notes'] as const,
  health: (id: string) => ['contracts', id, 'health'] as const,
  extractionConfidence: (id: string) => ['contracts', id, 'extraction-confidence'] as const,
}

// ============================================================================
// Contract Detail Query — fetches core contract + secondary data in parallel
// ============================================================================

async function fetchContract(id: string, dataMode: string): Promise<ContractData> {
  const response = await fetch(`/api/contracts/${id}`, {
    headers: { 'x-data-mode': dataMode },
  })
  if (response.status === 404) {
    throw new Error('Contract not found. It may have been deleted or the ID is invalid.')
  }
  if (!response.ok) {
    throw new Error(`Failed to load contract: ${response.status}`)
  }
  const raw = await response.json()
  const data = raw.data ?? raw
  if (data.error) throw new Error(data.error)
  return data
}

export function useContractQuery(id: string, dataMode: string) {
  return useQuery({
    queryKey: [...contractKeys.detail(id), dataMode],
    queryFn: () => fetchContract(id, dataMode),
    staleTime: STALE_TIMES.dynamic,
    refetchOnWindowFocus: true,
  })
}

// ============================================================================
// Versions Query
// ============================================================================

async function fetchVersions(id: string, dataMode: string): Promise<{ versions: ContractVersion[]; currentVersionNumber: number }> {
  const response = await fetch(`/api/contracts/${id}/versions`, {
    headers: { 'x-data-mode': dataMode },
  })
  if (!response.ok) return { versions: [], currentVersionNumber: 1 }

  const raw = await response.json()
  const data = raw.data ?? raw
  if (!data.versions || !Array.isArray(data.versions)) return { versions: [], currentVersionNumber: 1 }

  const versions = data.versions.map((v: any) => ({
    id: v.id,
    version: `v${v.versionNumber}.0`,
    title: v.summary || (v.isActive ? 'Current Version' : `Version ${v.versionNumber}`),
    createdAt: new Date(v.uploadedAt),
    createdBy: v.uploadedBy || 'System',
    status: v.isActive ? 'active' as const : 'archived' as const,
  }))

  const activeVersion = data.versions.find((v: any) => v.isActive)
  const currentVersionNumber = activeVersion
    ? activeVersion.versionNumber
    : data.versions.length > 0
      ? Math.max(...data.versions.map((v: any) => v.versionNumber))
      : 1

  return { versions, currentVersionNumber }
}

export function useVersionsQuery(id: string, dataMode: string) {
  return useQuery({
    queryKey: contractKeys.versions(id),
    queryFn: () => fetchVersions(id, dataMode),
    staleTime: STALE_TIMES.semiDynamic,
  })
}

// ============================================================================
// Notes Query
// ============================================================================

async function fetchNotes(id: string): Promise<ContractNote[]> {
  const response = await fetch(`/api/contracts/${id}/notes`, {
    headers: { 'x-tenant-id': getTenantId() },
  })
  if (!response.ok) return []

  const raw = await response.json()
  const data = raw.data ?? raw
  if (!data.notes || !Array.isArray(data.notes)) return []

  return data.notes.map((n: any) => ({
    id: n.id,
    content: n.content,
    createdAt: new Date(n.createdAt),
    updatedAt: n.updatedAt ? new Date(n.updatedAt) : undefined,
    author: n.author || { id: 'unknown', name: 'Unknown User' },
    isPinned: n.isPinned || false,
  }))
}

export function useNotesQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: contractKeys.notes(id),
    queryFn: () => fetchNotes(id),
    staleTime: STALE_TIMES.dynamic,
    enabled,
  })
}

// ============================================================================
// Health Data Query
// ============================================================================

async function fetchHealth(id: string): Promise<HealthData | null> {
  const response = await fetch(`/api/contracts/${id}/family-health`)
  if (!response.ok) return null

  const raw = await response.json()
  const data = raw.data ?? raw
  if (data.success === false) return null

  return {
    healthScore: data.healthScore ?? 100,
    completeness: data.completeness ?? 0,
    issues: data.issues || [],
  }
}

export function useHealthQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: contractKeys.health(id),
    queryFn: () => fetchHealth(id),
    staleTime: STALE_TIMES.semiDynamic,
    enabled,
  })
}

// ============================================================================
// Extraction Confidence Query
// ============================================================================

async function fetchExtractionConfidence(id: string): Promise<number | undefined> {
  const response = await fetch(`/api/contracts/${id}/extraction-confidence`, {
    headers: { 'x-tenant-id': getTenantId() },
  })
  if (!response.ok) return undefined

  const data = await response.json()
  if (data.success && data.data?.summary?.averageConfidence != null) {
    return data.data.summary.averageConfidence
  }
  return undefined
}

export function useExtractionConfidenceQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: contractKeys.extractionConfidence(id),
    queryFn: () => fetchExtractionConfidence(id),
    staleTime: STALE_TIMES.semiDynamic,
    enabled,
  })
}

// ============================================================================
// Mutations
// ============================================================================

export function useContractPatch(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await fetch(`/api/contracts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Update failed')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(id) })
    },
  })
}

export function useToggleFavorite(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (favorite: boolean) => {
      const response = await fetch(`/api/contracts/${id}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ favorite }),
      })
      if (!response.ok) throw new Error('Failed to toggle favorite')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(id) })
    },
  })
}

export function useNoteMutations(id: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: contractKeys.notes(id) })

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/contracts/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ content }),
      })
      if (!response.ok) throw new Error('Failed to add note')
    },
    onSuccess: invalidate,
  })

  const editNote = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const response = await fetch(`/api/contracts/${id}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ content }),
      })
      if (!response.ok) throw new Error('Failed to edit note')
    },
    onSuccess: invalidate,
  })

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await fetch(`/api/contracts/${id}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': getTenantId() },
      })
      if (!response.ok) throw new Error('Failed to delete note')
    },
    onSuccess: invalidate,
  })

  const pinNote = useMutation({
    mutationFn: async ({ noteId, isPinned }: { noteId: string; isPinned: boolean }) => {
      const response = await fetch(`/api/contracts/${id}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ isPinned }),
      })
      if (!response.ok) throw new Error('Failed to update note')
    },
    onSuccess: invalidate,
  })

  return { addNote, editNote, deleteNote, pinNote }
}

export function useDeleteContract(id: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/contracts/${id}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': getTenantId() },
      })
      if (!response.ok) throw new Error('Failed to delete contract')
    },
  })
}

export function useCategoryMutations(id: string) {
  const queryClient = useQueryClient()

  const setCategory = useMutation({
    mutationFn: async (categoryId: string) => {
      const response = await fetch(`/api/contracts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ categoryId }),
      })
      if (!response.ok) throw new Error('Failed to update category')
      toast.success('Category updated successfully')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(id) })
    },
  })

  const aiCategorize = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/contracts/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ contractIds: [id], force: true }),
      })
      if (!response.ok) throw new Error('Failed to categorize')
      const data = await response.json()
      const result = data.data?.results?.[0]
      if (result?.success && result?.category) {
        toast.success(`Contract categorized as "${result.category}" (${result.confidence}% confidence)`)
      } else {
        const errorReason = result?.error || ''
        if (errorReason.includes('No taxonomy categories')) {
          toast.error('No categories defined. Go to Settings → Taxonomy to set up categories.', { duration: 5000 })
        } else if (errorReason.includes('No text available')) {
          toast.warning('Contract has no text to analyze. Try uploading a document first.')
        } else if (errorReason.includes('AI not configured')) {
          toast.error('AI service not available. Please configure OpenAI API key or add keywords to categories.', { duration: 5000 })
        } else if (errorReason.includes('No category keywords')) {
          toast.warning('Add keywords to your categories in Settings → Taxonomy for automatic categorization.', { duration: 5000 })
        } else if (errorReason) {
          toast.warning(errorReason, { duration: 5000 })
        } else {
          toast.warning('Could not determine category. Try selecting one manually.')
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(id) })
    },
  })

  return { setCategory, aiCategorize }
}

export function useAIExtraction(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/contracts/${id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ force: true }),
      })
      if (!response.ok) throw new Error('AI extraction failed')
      toast.success('AI extraction started. This may take a few moments...')
      // Wait for processing to start before invalidating
      await new Promise(resolve => setTimeout(resolve, 3000))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(id) })
      toast.success('AI extraction completed!')
    },
    onError: () => {
      toast.error('Failed to start AI extraction.')
    },
  })
}

export function useExtractObligations(id: string) {
  return useMutation({
    mutationFn: async () => {
      toast.info('Extracting obligations from contract...')
      const response = await fetch('/api/obligations/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ action: 'extract', contractId: id }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to extract obligations')
      }
      return response.json()
    },
  })
}

export function useExtendContract(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      newExpirationDate: string
      newTotalValue?: number
      extensionNote?: string
    }) => {
      const response = await fetch(`/api/contracts/${id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errResp = await response.json()
        const err = errResp.error
        throw new Error((typeof err === 'object' ? err?.message : err) || 'Failed to extend contract')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(id) })
    },
  })
}

export function useUploadSignedCopy(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, signers, notes }: { file: File; signers?: string; notes?: string }) => {
      const formData = new FormData()
      formData.append('file', file)
      if (signers) formData.append('signers', signers)
      if (notes) formData.append('notes', notes)
      const response = await fetch(`/api/contracts/${id}/signed-copy`, {
        method: 'POST',
        headers: { 'x-tenant-id': getTenantId() },
        body: formData,
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error || 'Upload failed')
      }
      toast.success('Signed copy uploaded successfully! Contract marked as signed.')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(id) })
    },
  })
}
