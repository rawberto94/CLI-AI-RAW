'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UseCaseCTAProps } from '@/lib/use-cases/types'
import { Rocket, Calendar, Download } from 'lucide-react'

export default function UseCaseCTA({
  primaryAction,
  secondaryAction,
  downloadAction
}: UseCaseCTAProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white">
        <CardContent className="p-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3">
              Ready to Transform Your Contract Management?
            </h2>
            <p className="text-xl text-white/90">
              Start your pilot today and see results in weeks, not months
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={primaryAction.onClick}
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-6 text-lg font-semibold"
            >
              <Rocket className="w-5 h-5 mr-2" />
              {primaryAction.label}
            </Button>

            <Button
              size="lg"
              onClick={secondaryAction.onClick}
              variant="outline"
              className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg"
            >
              <Calendar className="w-5 h-5 mr-2" />
              {secondaryAction.label}
            </Button>

            <Button
              size="lg"
              onClick={downloadAction.onClick}
              variant="outline"
              className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg"
            >
              <Download className="w-5 h-5 mr-2" />
              {downloadAction.label}
            </Button>
          </div>

          <div className="mt-8 text-center text-white/80 text-sm">
            <p>6-8 week pilot • 2 client tenants • 120 contracts analyzed • Proven ROI</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}