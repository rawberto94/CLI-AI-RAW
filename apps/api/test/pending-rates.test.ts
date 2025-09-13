import { describe, it, expect } from 'vitest'

// This is a minimal smoke test harness using the store module directly.
import {
  validatePendingRateShape,
  addPendingRate,
  listPendingRates,
  updatePendingRate,
  approvePendingRate,
  approveAllValidPending,
  bulkRejectPending,
  listManualRates,
} from '../store'

describe('pending rates workflow', () => {
  it('validates missing fields', () => {
    const errs = validatePendingRateShape({})
    expect(errs.length).toBeGreaterThan(0)
  })

  it('can add, edit to fix, and approve', () => {
    const r = addPendingRate({ role: 'Consultant', currency: 'USD', uom: 'day', amount: 600 })
    // this is valid, should have no errors
    expect(r.validationErrors.length).toBe(0)

    const p = listPendingRates().find(x => x.id === r.id)!
    const updated = updatePendingRate(p.id, { dailyUsd: 600 })!
    expect(updated.validationErrors.length).toBe(0)

    const res = approvePendingRate(p.id)
    expect(res.approved).toBeTruthy()
  // Verify it moved out of pending and into manual repository
  const stillThere = listPendingRates().find(x => x.id === r.id)
  expect(stillThere).toBeUndefined()
  const repo = listManualRates()
  expect(repo.some(m => m.role === 'Consultant' && m.currency === 'USD')).toBe(true)
  })

  it('bulk approve approves only valid', () => {
    addPendingRate({ role: 'Analyst', currency: 'USD', uom: 'day', amount: 500 }) // valid
    addPendingRate({ role: '', currency: 'USD', uom: 'day', amount: 500 }) // invalid
    const res = approveAllValidPending()
    expect(res.approved).toBeGreaterThan(0)
    expect(res.invalid).toBeGreaterThan(0)
  })

  it('bulk reject removes selected entries', () => {
    const a = addPendingRate({ role: 'Engineer', currency: 'USD', uom: 'day', amount: 700 })
    const b = addPendingRate({ role: 'Architect', currency: 'USD', uom: 'day', amount: 900 })
    const before = listPendingRates().length
    const out = bulkRejectPending([a.id, b.id])
    expect(out.rejected).toBe(2)
    const after = listPendingRates().length
    expect(after).toBe(before - 2)
  })
})
