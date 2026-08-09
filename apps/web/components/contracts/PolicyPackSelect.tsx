'use client'

import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'

interface PackOption {
  id: string
  name: string
  isDefault?: boolean
  status?: string
}

interface PolicyPackSelectProps {
  value?: string | null
  onChange: (packId: string | null) => void
  className?: string
}

const SESSION_KEY = 'contigo.policyPackId'

/**
 * Compact pack selector for upload flows.
 * "Auto" leaves resolution to scope/default pack.
 */
export function PolicyPackSelect({ value, onChange, className }: PolicyPackSelectProps) {
  const [packs, setPacks] = useState<PackOption[]>([])
  const [internal, setInternal] = useState<string>(value || '')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/policy-packs?status=active')
        if (!res.ok) return
        const json = await res.json()
        const list = (json.data?.packs || json.packs || []) as PackOption[]
        if (!cancelled) {
          setPacks(list.filter((p) => p.status === 'active' || !p.status))
          if (!value) {
            const sticky = typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null
            if (sticky) {
              setInternal(sticky)
              onChange(sticky)
            }
          }
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (value !== undefined && value !== null) setInternal(value)
  }, [value])

  const handleChange = (v: string) => {
    setInternal(v)
    const id = v || null
    if (typeof window !== 'undefined') {
      if (id) sessionStorage.setItem(SESSION_KEY, id)
      else sessionStorage.removeItem(SESSION_KEY)
    }
    onChange(id)
  }

  const defaultPack = packs.find((p) => p.isDefault)

  return (
    <div className={className}>
      <Label className="text-sm text-gray-600 dark:text-gray-300">Policy pack</Label>
      <select
        className="mt-1 w-full border rounded-md h-9 px-2 text-sm bg-background"
        value={internal}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">
          Auto{defaultPack ? ` (${defaultPack.name})` : ' (recommended)'}
        </option>
        {packs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isDefault ? ' ★' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
