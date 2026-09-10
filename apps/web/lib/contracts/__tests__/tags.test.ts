import { describe, expect, it } from 'vitest'

import { DEFAULT_TAGS, getAllTags, getTagById, getTagColor } from '../tags'

describe('contract tag display helpers', () => {
  it('does not read or write browser storage', () => {
    expect(getAllTags()).toEqual(DEFAULT_TAGS)
    expect(getTagById('urgent')?.name).toBe('Urgent')
    expect(getTagColor('purple')).toMatch(/purple/)
  })
})
