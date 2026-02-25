/**
 * FeaturesGrid — feature cards shown when no files are queued
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Shield, Brain, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  { icon: Zap, gradient: 'from-violet-500 to-purple-600', title: 'Lightning Fast', desc: 'AI extraction in seconds' },
  { icon: Shield, gradient: 'from-violet-500 to-violet-600', title: 'Secure Storage', desc: 'Bank-grade encryption' },
  { icon: Brain, gradient: 'from-violet-500 to-pink-600', title: 'AI Analysis', desc: 'GPT-4 powered insights' },
  { icon: BarChart3, gradient: 'from-orange-500 to-red-600', title: 'Smart Reports', desc: '10 artifact types' },
] as const;

export function FeaturesGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {features.map(feature => (
        <Card key={feature.title} className="border-0 dark:border dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-shadow motion-reduce:transition-none dark:bg-slate-800/80">
          <CardContent className="p-6">
            <div className={cn('p-3 rounded-xl shadow-lg w-fit mb-4 bg-gradient-to-br', feature.gradient)}>
              <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{feature.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default FeaturesGrid;
