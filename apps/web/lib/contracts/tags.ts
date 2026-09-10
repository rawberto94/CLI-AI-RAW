/**
 * Display helpers for contract tags.
 * Persistence lives on the contract + tenant tag registry
 * (`/api/contracts/[id]/metadata/tags`, `/api/contracts/bulk/tags`).
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
    blue: 'bg-violet-100 text-violet-800 border-violet-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    pink: 'bg-pink-100 text-pink-800 border-pink-200',
  }
  return colors[color] ?? colors.gray ?? 'bg-gray-100 text-gray-800 border-gray-200'
}

export function getTagById(tagId: string): Tag | undefined {
  return DEFAULT_TAGS.find(tag => tag.id === tagId)
}

export function getAllTags(): Tag[] {
  return DEFAULT_TAGS
}
