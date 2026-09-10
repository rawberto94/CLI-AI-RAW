import { describe, expect, it } from 'vitest'

import { normalizeExtractedClauses } from '../extracted-clauses'

describe('normalizeExtractedClauses', () => {
  it('reads the worker prompt shape (title/content/fullText/source)', () => {
    const clauses = normalizeExtractedClauses({
      clauses: [
        {
          title: 'Limitation of Liability',
          section: '8.1',
          content: 'Mutual exclusion of consequential damages.',
          fullText: 'In no event shall either party be liable for any indirect damages.',
          source: 'In no event shall either party be liable for any indirect damages.',
          importance: 'high',
          category: 'liability',
        },
      ],
    })
    expect(clauses).toHaveLength(1)
    expect(clauses[0]?.title).toBe('Limitation of Liability')
    expect(clauses[0]?.section).toBe('8.1')
    expect(clauses[0]?.snippet).toMatch(/indirect damages/)
    expect(clauses[0]?.fullText).toMatch(/indirect damages/)
  })

  it('also accepts the schema shape (clauseId/text/page)', () => {
    const clauses = normalizeExtractedClauses({
      clauses: [
        {
          clauseId: '5.2',
          text: 'Either party may terminate for convenience with 90 days written notice.',
          page: 4,
        },
      ],
    })
    expect(clauses).toHaveLength(1)
    expect(clauses[0]?.title).toBe('5.2')
    expect(clauses[0]?.section).toBe('5.2')
    expect(clauses[0]?.snippet).toMatch(/90 days written notice/)
    expect(clauses[0]?.page).toBe(4)
  })

  it('prefers a verbatim source quote over a paraphrased summary for citations', () => {
    const clauses = normalizeExtractedClauses({
      keyClauses: [
        {
          title: 'Indemnity',
          content: 'Vendor covers Client for negligence claims.',
          source: 'Vendor shall indemnify and hold harmless Client from claims arising from Vendor\'s negligence.',
        },
      ],
    })
    expect(clauses[0]?.summary).toMatch(/covers Client/)
    expect(clauses[0]?.snippet).toMatch(/hold harmless/)
  })

  it('dedupes overlapping clauses/keyClauses lists', () => {
    const clauses = normalizeExtractedClauses({
      clauses: [{ title: 'Cap', source: 'liability shall not exceed twelve months of fees' }],
      keyClauses: [{ title: 'Cap', source: 'liability shall not exceed twelve months of fees' }],
    })
    expect(clauses).toHaveLength(1)
  })
})
