/**
 * Contracts Dashboard - Upcoming Renewals Component
 * Displays contracts that are expiring soon with priority indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertCircle, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Renewal {
  id: string;
  name: string;
  type: string;
  endDate: string;
  daysUntilExpiry: number;
  priority: 'urgent' | 'high' | 'medium';
}

interface UpcomingRenewalsProps {
  renewals: Renewal[];
}

const priorityConfig = {
  urgent: {
    color: 'destructive',
    icon: AlertCircle,
    label: 'Urgent',
    bgClass: 'bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-850'
  },
  high: {
    color: 'default' as const,
    icon: Clock,
    label: 'High Priority',
    bgClass: 'bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-850'
  },
  medium: {
    color: 'secondary' as const,
    icon: Calendar,
    label: 'Medium Priority',
    bgClass: 'bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-850'
  }
};

export function UpcomingRenewals({ renewals }: UpcomingRenewalsProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-600" />
            Upcoming Renewals
          </CardTitle>
          <Badge variant="outline">{renewals.length} contracts</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Contracts expiring in the next 90 days
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {renewals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No upcoming renewals</p>
          </div>
        ) : (
          <>
            {renewals.map((renewal) => {
              const config = priorityConfig[renewal.priority];
              const Icon = config.icon;
              
              return (
                <div
                  key={renewal.id}
                  className="p-4 rounded-lg border bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`h-4 w-4 ${
                          renewal.priority === 'urgent' ? 'text-red-600' :
                          renewal.priority === 'high' ? 'text-orange-600' :
                          'text-blue-600'
                        }`} />
                        <Link 
                          href={`/contracts/${renewal.id}`}
                          className="font-medium text-sm truncate hover:underline hover:text-blue-600"
                        >
                          {renewal.name}
                        </Link>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{renewal.type}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">
                          Expires: {new Date(renewal.endDate).toLocaleDateString()}
                        </span>
                        <Badge variant={config.color} className="text-xs">
                          {renewal.daysUntilExpiry} days left
                        </Badge>
                      </div>
                    </div>
                    <Link 
                      href={`/contracts/${renewal.id}`}
                      className="text-muted-foreground hover:text-blue-600 flex-shrink-0 mt-1"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
            
            <Button variant="outline" size="sm" className="w-full mt-4" asChild>
              <Link href="/contracts?filter=expiring">
                View All Renewals
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
