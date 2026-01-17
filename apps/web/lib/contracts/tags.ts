/**
 * Contract Tags Management
 */

export interface Tag {
  id: string
  name: string
  color: string
  description?: string
}

export const DEFAULT_TAGS: Tag[] = [
  { id: 'urgent', name: 'Urgent', color: 'red', description: 'Requires immediate attention' },
  { id: 'review', name: 'Review', color: 'yellow', description: 'Needs review' },
  { id: 'approved', name: 'Approved', color: 'green', description: 'Approved for use' },
  { id: 'archived', name: 'Archived', color: 'gray', description: 'Archived contract' },
  { id: 'renewal', name: 'Renewal', color: 'blue', description: 'Up for renewal' },
  { id: 'high-value', name: 'High Value', color: 'purple', description: 'High value contract' },
  { id: 'expiring-soon', name: 'Expiring Soon', color: 'orange', description: 'Expires within 90 days' },
  { id: 'favorite', name: 'Favorite', color: 'pink', description: 'Marked as favorite' },
]

export function getTagColor(color: string): string {
  const colors: Record<string, string> = {
    red: 'bg-red-100 text-red-800 border-red-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    pink: 'bg-pink-100 text-pink-800 border-pink-200',
  }
  return colors[color] ?? colors.gray ?? 'bg-gray-100 text-gray-800 border-gray-200'
}

export function getTagById(tagId: string): Tag | undefined {
  return DEFAULT_TAGS.find(tag => tag.id === tagId)
}

// Local storage keys
const TAGS_STORAGE_KEY = 'contract-tags'
const CONTRACT_TAGS_STORAGE_KEY = 'contract-tag-assignments'

/**
 * Get all available tags
 */
export function getAllTags(): Tag[] {
  if (typeof window === 'undefined') return DEFAULT_TAGS
  
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Error loading tags - silently ignored
  }
  
  return DEFAULT_TAGS
}

/**
 * Save tags to storage
 */
export function saveTags(tags: Tag[]): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags))
  } catch {
    // Error saving tags - silently ignored
  }
}

/**
 * Get tags for a specific contract
 */
export function getContractTags(contractId: string): string[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(CONTRACT_TAGS_STORAGE_KEY)
    if (stored) {
      const assignments: Record<string, string[]> = JSON.parse(stored)
      return assignments[contractId] || []
    }
  } catch {
    // Error loading contract tags - silently ignored
  }
  
  return []
}

/**
 * Set tags for a specific contract
 */
export function setContractTags(contractId: string, tagIds: string[]): void {
  if (typeof window === 'undefined') return
  
  try {
    const stored = localStorage.getItem(CONTRACT_TAGS_STORAGE_KEY)
    const assignments: Record<string, string[]> = stored ? JSON.parse(stored) : {}
    
    assignments[contractId] = tagIds
    
    localStorage.setItem(CONTRACT_TAGS_STORAGE_KEY, JSON.stringify(assignments))
  } catch {
    // Error saving contract tags - silently ignored
  }
}

/**
 * Add a tag to a contract
 */
export function addTagToContract(contractId: string, tagId: string): void {
  const currentTags = getContractTags(contractId)
  if (!currentTags.includes(tagId)) {
    setContractTags(contractId, [...currentTags, tagId])
  }
}

/**
 * Remove a tag from a contract
 */
export function removeTagFromContract(contractId: string, tagId: string): void {
  const currentTags = getContractTags(contractId)
  setContractTags(contractId, currentTags.filter(id => id !== tagId))
}

/**
 * Toggle a tag on a contract
 */
export function toggleContractTag(contractId: string, tagId: string): void {
  const currentTags = getContractTags(contractId)
  if (currentTags.includes(tagId)) {
    removeTagFromContract(contractId, tagId)
  } else {
    addTagToContract(contractId, tagId)
  }
}

/**
 * Create a new custom tag
 */
export function createTag(tag: Omit<Tag, 'id'>): Tag {
  const newTag: Tag = {
    ...tag,
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  }
  
  const allTags = getAllTags()
  saveTags([...allTags, newTag])
  
  return newTag
}

/**
 * Delete a custom tag
 */
export function deleteTag(tagId: string): void {
  const allTags = getAllTags()
  const filtered = allTags.filter(tag => tag.id !== tagId)
  saveTags(filtered)
  
  // Remove tag from all contracts
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(CONTRACT_TAGS_STORAGE_KEY)
      if (stored) {
        const assignments: Record<string, string[]> = JSON.parse(stored)
        Object.keys(assignments).forEach(contractId => {
          const contractAssignments = assignments[contractId]
          if (contractAssignments) {
            assignments[contractId] = contractAssignments.filter(id => id !== tagId)
          }
        })
        localStorage.setItem(CONTRACT_TAGS_STORAGE_KEY, JSON.stringify(assignments))
      }
    } catch {
      // Error removing tag from contracts - silently ignored
    }
  }
}
