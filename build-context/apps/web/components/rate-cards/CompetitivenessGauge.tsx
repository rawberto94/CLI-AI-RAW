'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CompetitivenessGaugeProps {
  score: number;
  ranking: string;
}

export function CompetitivenessGauge({ score, ranking }: CompetitivenessGaugeProps) {
  const getColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-violet-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBadgeVariant = (ranking: string) => {
    if (ranking === 'Excellent') return 'default';
    if (ranking === 'Good') return 'secondary';
    if (ranking === 'Average') return 'outline';
    return 'destructive';
  };

  // Calculate gauge rotation (0-180 degrees)
  const rotation = (score / 100) * 180;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overall Competitiveness</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Gauge */}
          <div className="relative w-48 h-24 mb-4">
            {/* Background arc */}
            <svg className="w-full h-full" viewBox="0 0 200 100">
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="20"
                strokeLinecap="round"
              />
              {/* Colored arc */}
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="currentColor"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 251.2} 251.2`}
                className={getColor(score)}
              />
            </svg>
            
            {/* Needle */}
            <div
              className="absolute bottom-0 left-1/2 w-1 h-20 bg-gray-800 origin-bottom"
              style={{
                transform: `translateX(-50%) rotate(${rotation - 90}deg)`,
                transition: 'transform 1s ease-out',
              }}
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gray-800" />
            </div>
          </div>

          {/* Score */}
          <div className={`text-5xl font-bold ${getColor(score)}`}>{score}</div>
          <p className="text-sm text-muted-foreground mt-1">out of 100</p>

          {/* Ranking Badge */}
          <Badge variant={getBadgeVariant(ranking)} className="mt-4">
            {ranking}
          </Badge>

          {/* Scale Labels */}
          <div className="flex justify-between w-full mt-6 text-xs text-muted-foreground">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
