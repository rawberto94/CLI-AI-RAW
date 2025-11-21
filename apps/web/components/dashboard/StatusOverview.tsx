/**
 * Contracts Dashboard - Status Overview
 * Real-time view of contract processing status
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  FileText,
  Activity
} from "lucide-react";

interface StatusBreakdown {
  status: string;
  count: number;
}

interface StatusOverviewProps {
  data: StatusBreakdown[];
  totalContracts: number;
}

const statusConfig: Record<string, { 
  label: string; 
  icon: any; 
  color: string;
  bgClass: string;
}> = {
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle,
    color: 'text-green-600',
    bgClass: 'bg-green-50 dark:bg-green-950'
  },
  PROCESSING: {
    label: 'Processing',
    icon: Activity,
    color: 'text-blue-600',
    bgClass: 'bg-blue-50 dark:bg-blue-950'
  },
  UPLOADED: {
    label: 'Uploaded',
    icon: Clock,
    color: 'text-yellow-600',
    bgClass: 'bg-yellow-50 dark:bg-yellow-950'
  },
  FAILED: {
    label: 'Failed',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgClass: 'bg-red-50 dark:bg-red-950'
  }
};

export function StatusOverview({ data, totalContracts }: StatusOverviewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base mb-1">
          <Activity className="h-4 w-4 text-blue-600" />
          Contract Status
        </CardTitle>
        <p className="text-sm text-muted-foreground">Real-time processing overview</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No contracts found</p>
          </div>
        ) : (
          <>
            {data.map((item) => {
              const config = statusConfig[item.status] || {
                label: item.status,
                icon: FileText,
                color: 'text-gray-600',
                bgClass: 'bg-gray-50 dark:bg-gray-950'
              };
              const Icon = config.icon;
              const percentage = totalContracts > 0 ? (item.count / totalContracts) * 100 : 0;
              
              return (
                <div key={item.status} className={`p-4 rounded-lg border ${config.bgClass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <span className="font-medium">{config.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{item.count}</div>
                      <div className="text-xs text-muted-foreground">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
            
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Contracts</span>
                <span className="text-2xl font-bold">{totalContracts.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
