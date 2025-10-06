"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Rocket, X, Sparkles, Play } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export function FloatingDemoButton() {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();
  
  // Don't show on demo pages themselves
  if (pathname === '/pilot-demo' || pathname === '/mvp') {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isExpanded ? (
        <Card className="w-80 shadow-2xl border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Demo Center</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <Link href="/pilot-demo" onClick={() => setIsExpanded(false)}>
                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white hover:from-blue-600 hover:to-purple-700 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Rocket className="w-5 h-5" />
                    <div>
                      <div className="font-semibold text-sm">Chain IQ Pilot Demo</div>
                      <div className="text-xs text-blue-100">Executive presentation ready</div>
                    </div>
                    <Sparkles className="w-4 h-4 ml-auto animate-pulse" />
                  </div>
                </div>
              </Link>
              
              <Link href="/mvp" onClick={() => setIsExpanded(false)}>
                <div className="p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Play className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-semibold text-sm text-gray-900">MVP Showcase</div>
                      <div className="text-xs text-gray-600">Interactive demo features</div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
            
            <div className="mt-3 text-xs text-gray-500 text-center">
              Perfect for executive presentations
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setIsExpanded(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110"
        >
          <div className="flex flex-col items-center">
            <Rocket className="w-5 h-5" />
            <Sparkles className="w-3 h-3 animate-pulse" />
          </div>
        </Button>
      )}
    </div>
  );
}