import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisCoverageChip } from '../AnalysisCoverageChip'

describe('AnalysisCoverageChip', () => {
  it('renders skipped sections from analysisPack', () => {
    render(
      <AnalysisCoverageChip
        pack={{ originalChars: 10000, packedChars: 4000, omitted: ['Table of Contents', 'EXHIBIT B Marketing Brochure'] }}
      />,
    )
    expect(screen.getByLabelText(/2 sections skipped/i)).toBeTruthy()
  })

  it('renders nothing when there is no pack and OCR is fine', () => {
    const { container } = render(<AnalysisCoverageChip />)
    expect(container.textContent).toBe('')
  })

  it('shows German analysis language', () => {
    render(<AnalysisCoverageChip analysisLanguage="de" />)
    expect(screen.getByLabelText(/Analysis in German/i)).toBeTruthy()
  })
})
