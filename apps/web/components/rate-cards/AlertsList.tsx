'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
}

interface AlertsListProps {
  userId: string;
}

export function AlertsList({ userId }: AlertsListProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    
  }, [userId]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`/api/rate-cards/alerts?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      
      const data = await response.json();
      setAlerts(data);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const response = await fetch('/api/rate-cards/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: alertId }),
      });

      if (!response.ok) throw new Error('Failed to mark as read');

      setAlerts(alerts.map(a => 
        a.id === alertId ? { ...a, read: true } : a
      ));
    } catch {
      // Error handled silently
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/rate-cards/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, markAllAsRead: true }),
      });

      if (!response.ok) throw new Error('Failed to mark all as read');

      setAlerts(alerts.map(a => ({ ...a, read: true })));
    } catch {
      // Error handled silently
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-violet-100 text-violet-800 border-violet-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rate_increase': return '📈';
      case 'market_shift': return '🔄';
      case 'opportunity': return '💡';
      case 'quality_issue': return '⚠️';
      case 'supplier_alert': return '🏢';
      default: return '🔔';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading alerts...</div>;
  }

  const unreadCount = Array.isArray(alerts) ? alerts.filter(a => !a.read).length : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          Alerts {unreadCount > 0 && (
            <span className="ml-2 text-sm bg-red-500 text-white px-2 py-1 rounded-full">
              {unreadCount} new
            </span>
          )}
        </h2>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" size="sm">
            Mark All as Read
          </Button>
        )}
      </div>

      {alerts.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No alerts to display
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-4 border-l-4 ${getSeverityColor(alert.severity)} ${
                !alert.read ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{getTypeIcon(alert.type)}</span>
                    <h3 className={`font-semibold ${!alert.read ? 'text-gray-900' : 'text-gray-600'}`}>
                      {alert.title}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
                {!alert.read && (
                  <Button
                    onClick={() => markAsRead(alert.id)}
                    variant="ghost"
                    size="sm"
                  >
                    Mark as Read
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
