import { describe, it, expect } from 'vitest'
import { mapRoleDetail } from '../mapping'

describe('mapRoleDetail', () => {
  it('maps Senior Consultant variants', () => {
    const r = mapRoleDetail('Sr. Consultant')
    expect(r.role).toBe('Senior Consultant')
    expect(r.seniority).toBe('Senior')
    expect(r.confidence).toBeGreaterThan(0.5)
  })
  it('maps Manager', () => {
    const r = mapRoleDetail('Project Manager')
    expect(r.role).toBe('Manager')
  })
  it('defaults reasonably', () => {
    const r = mapRoleDetail('Ninja Wizard')
    expect(r.role).toBeTruthy()
    expect(r.confidence).toBeGreaterThan(0)
  })
})
