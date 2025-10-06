'use client'

import React from 'react'
import { formatCHF } from '@/lib/use-cases/rate-normalizer'

interface RateCard {
  id: string
  clientName: string
  role: string
  level: string
  dailyRateCHF: number
  lastUpdated: Date | string
}

interface ExpandableRateCardsProps {
  rateCards: RateCard[]
  isExpanded: boolean
}

export function ExpandableRateCards({ rateCards, isExpanded }: ExpandableRateCardsProps) {
  if (!isExpanded) return null
  
  return (
    <tr>
      <td colSpan={7} className="bg-gray-50 p-4">
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 px-3 font-medium text-gray-700">Client</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Role</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Level</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Daily Rate</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {rateCards.map((card) => {
                const lastUpdated = card.lastUpdated instanceof Date 
                  ? card.lastUpdated 
                  : new Date(card.lastUpdated)
                
                return (
                  <tr key={card.id} className="border-b border-gray-200">
                    <td className="py-2 px-3 text-gray-900">{card.clientName}</td>
                    <td className="py-2 px-3 text-gray-900">{card.role}</td>
                    <td className="py-2 px-3 text-gray-600">{card.level}</td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-900">
                      {formatCHF(card.dailyRateCHF, { decimals: 0 })}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      {lastUpdated.toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}
