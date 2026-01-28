'use client';

import { AIActivityFeed } from '@/components/ai/AIActivityFeed';

export default function AIActivityPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Activity Monitor</h1>
          <p className="text-muted-foreground">
            Track AI agent activities and decisions in real-time
          </p>
        </div>
      </div>
      <AIActivityFeed />
    </div>
  );
}
