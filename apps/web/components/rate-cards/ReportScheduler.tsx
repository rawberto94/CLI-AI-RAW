'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ReportSchedule {
  name: string;
  type: string;
  frequency: string;
  recipients: string[];
  filters?: any;
}

interface ReportSchedulerProps {
  tenantId: string;
  userId: string;
  onSchedule?: (schedule: ReportSchedule) => void;
}

export function ReportScheduler({ tenantId, userId, onSchedule }: ReportSchedulerProps) {
  const [schedule, setSchedule] = useState<ReportSchedule>({
    name: '',
    type: 'executive',
    frequency: 'weekly',
    recipients: [''],
  });

  const [saving, setSaving] = useState(false);

  const handleAddRecipient = () => {
    setSchedule({
      ...schedule,
      recipients: [...schedule.recipients, ''],
    });
  };

  const handleRemoveRecipient = (index: number) => {
    setSchedule({
      ...schedule,
      recipients: schedule.recipients.filter((_, i) => i !== index),
    });
  };

  const handleRecipientChange = (index: number, value: string) => {
    const newRecipients = [...schedule.recipients];
    newRecipients[index] = value;
    setSchedule({ ...schedule, recipients: newRecipients });
  };

  const handleSchedule = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/rate-cards/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId, schedule }),
      });

      if (!response.ok) throw new Error('Failed to schedule report');

      const scheduledReport = await response.json();
      onSchedule?.(scheduledReport);
      
      // Reset form
      setSchedule({
        name: '',
        type: 'executive',
        frequency: 'weekly',
        recipients: [''],
      });
    } catch (error) {
      console.error('Error scheduling report:', error);
    } finally {
      setSaving(false);
    }
  };

  const isValid = schedule.name && schedule.recipients.some(r => r.includes('@'));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Schedule Report</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Report Name</label>
          <input
            type="text"
            value={schedule.name}
            onChange={(e) => setSchedule({ ...schedule, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="e.g., Weekly Executive Summary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Report Type</label>
          <select
            value={schedule.type}
            onChange={(e) => setSchedule({ ...schedule, type: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="executive">Executive Summary</option>
            <option value="detailed">Detailed Report</option>
            <option value="opportunities">Opportunities Report</option>
            <option value="suppliers">Supplier Performance</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Frequency</label>
          <select
            value={schedule.frequency}
            onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Recipients</label>
          <div className="space-y-2">
            {schedule.recipients.map((recipient, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => handleRecipientChange(index, e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md"
                  placeholder="email@example.com"
                />
                {schedule.recipients.length > 1 && (
                  <Button
                    onClick={() => handleRemoveRecipient(index)}
                    variant="outline"
                    size="sm"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            onClick={handleAddRecipient}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            + Add Recipient
          </Button>
        </div>

        <Button
          onClick={handleSchedule}
          disabled={saving || !isValid}
          className="w-full"
        >
          {saving ? 'Scheduling...' : 'Schedule Report'}
        </Button>
      </div>
    </Card>
  );
}
