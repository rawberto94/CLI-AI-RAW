/**
 * Financial Artifact Content Renderer
 * Memoized component for rendering financial artifact data
 */

import React, { memo } from 'react';
import type { FinancialData } from '@/types/artifacts';

interface FinancialRendererProps {
  data: FinancialData;
}

export const FinancialRenderer = memo(function FinancialRenderer({ data }: FinancialRendererProps) {
  const finData = data.financial || data;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {finData.totalValue && (
          <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 rounded-xl border-2 border-green-200 dark:border-green-800 shadow-sm">
            <p className="text-sm text-green-700 dark:text-green-300 mb-2 font-semibold">Total Contract Value</p>
            <p className="text-3xl font-bold text-green-900 dark:text-green-100">
              ${finData.totalValue.toLocaleString()}
            </p>
          </div>
        )}
        {finData.currency && (
          <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 rounded-xl border-2 border-blue-200 dark:border-blue-800 shadow-sm">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2 font-semibold">Currency</p>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{finData.currency}</p>
          </div>
        )}
      </div>
      
      {finData.paymentTerms && finData.paymentTerms.length > 0 && (
        <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 rounded-xl border-2 border-purple-200 dark:border-purple-800 shadow-sm">
          <h4 className="font-bold text-base mb-4 text-purple-900 dark:text-purple-100">Payment Terms</h4>
          <ul className="space-y-2">
            {finData.paymentTerms.map((term, i) => (
              <li key={i} className="text-base text-purple-900/90 dark:text-purple-100/90 flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-1">●</span>
                <span>{term}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {finData.paymentSchedule && finData.paymentSchedule.length > 0 && (
        <div>
          <h4 className="font-bold text-base mb-4 text-gray-900 dark:text-gray-100">Payment Schedule</h4>
          <div className="space-y-3">
            {finData.paymentSchedule.map((payment, i) => (
              <div key={i} className="p-5 bg-white dark:bg-gray-800 rounded-xl border-2 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                <span className="font-semibold text-base text-gray-900 dark:text-gray-100">{payment.milestone}</span>
                <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                  ${payment.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {finData.rateCards && finData.rateCards.length > 0 && (
        <div>
          <h4 className="font-bold text-base mb-4 text-gray-900 dark:text-gray-100">Rate Cards</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {finData.rateCards.map((card, i) => (
              <div key={i} className="p-5 bg-white dark:bg-gray-800 rounded-xl border-2 shadow-sm flex justify-between hover:shadow-md transition-shadow">
                <span className="font-semibold text-base text-gray-900 dark:text-gray-100">{card.role || card.title}</span>
                <span className="text-green-600 dark:text-green-400 font-bold text-lg">${card.rate}/hr</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
