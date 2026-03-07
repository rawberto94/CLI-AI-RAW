"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Mail, Save, Trash2, Plus } from "lucide-react";

interface ScheduledReport {
  id: string;
  name: string;
  templateId: string;
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  recipients: string[];
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export function ScheduledReportsManager() {
  const { toast } = useToast();
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([
    {
      id: "1",
      name: "Weekly Supplier Performance",
      templateId: "supplier-performance",
      frequency: "weekly",
      dayOfWeek: 1, // Monday
      time: "09:00",
      recipients: ["manager@example.com"],
      enabled: true,
      lastRun: "2024-01-15T09:00:00Z",
      nextRun: "2024-01-22T09:00:00Z",
    },
    {
      id: "2",
      name: "Monthly Financial Report",
      templateId: "financial-summary",
      frequency: "monthly",
      dayOfMonth: 1,
      time: "08:00",
      recipients: ["finance@example.com", "cfo@example.com"],
      enabled: true,
      lastRun: "2024-01-01T08:00:00Z",
      nextRun: "2024-02-01T08:00:00Z",
    },
  ]);

  const [newReport, setNewReport] = useState<Partial<ScheduledReport>>({
    name: "",
    frequency: "weekly",
    time: "09:00",
    recipients: [],
    enabled: true,
  });

  const [recipientEmail, setRecipientEmail] = useState("");

  const handleAddRecipient = () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setNewReport({
      ...newReport,
      recipients: [...(newReport.recipients || []), recipientEmail],
    });
    setRecipientEmail("");
  };

  const handleRemoveRecipient = (email: string) => {
    setNewReport({
      ...newReport,
      recipients: (newReport.recipients || []).filter((e) => e !== email),
    });
  };

  const handleCreateSchedule = async () => {
    if (!newReport.name || !newReport.frequency) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if ((newReport.recipients || []).length === 0) {
      toast({
        title: "No recipients",
        description: "Please add at least one recipient.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/reports/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReport),
      });

      if (!response.ok) throw new Error("Failed to create schedule");

      const data = await response.json();

      setScheduledReports([...scheduledReports, data.schedule]);

      toast({
        title: "Schedule created",
        description: "Your report has been scheduled successfully.",
      });

      // Reset form
      setNewReport({
        name: "",
        frequency: "weekly",
        time: "09:00",
        recipients: [],
        enabled: true,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create schedule. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/reports/schedule/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) throw new Error("Failed to update schedule");

      setScheduledReports(
        scheduledReports.map((report) =>
          report.id === id ? { ...report, enabled } : report
        )
      );

      toast({
        title: enabled ? "Schedule enabled" : "Schedule disabled",
        description: `Report schedule has been ${enabled ? "enabled" : "disabled"}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update schedule. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const response = await fetch(`/api/reports/schedule/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete schedule");

      setScheduledReports(scheduledReports.filter((report) => report.id !== id));

      toast({
        title: "Schedule deleted",
        description: "Report schedule has been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete schedule. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getFrequencyLabel = (report: ScheduledReport) => {
    if (report.frequency === "daily") {
      return `Daily at ${report.time}`;
    } else if (report.frequency === "weekly") {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return `Weekly on ${days[report.dayOfWeek || 0]} at ${report.time}`;
    } else {
      return `Monthly on day ${report.dayOfMonth} at ${report.time}`;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Scheduled Reports</h2>
        <p className="text-muted-foreground">
          Automate report generation and delivery to your team
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Schedule</CardTitle>
          <CardDescription>
            Set up automated report generation and delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-name">Schedule Name</Label>
              <Input
                id="schedule-name"
                placeholder="e.g., Weekly Supplier Report"
                value={newReport.name}
                onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-template">Report Template</Label>
              <Select
                value={newReport.templateId}
                onValueChange={(value) =>
                  setNewReport({ ...newReport, templateId: value })
                }
              >
                <SelectTrigger id="report-template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier-performance">
                    Supplier Performance
                  </SelectItem>
                  <SelectItem value="rate-card-analysis">
                    Rate Card Analysis
                  </SelectItem>
                  <SelectItem value="contract-summary">
                    Contract Summary
                  </SelectItem>
                  <SelectItem value="financial-summary">
                    Financial Summary
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={newReport.frequency}
                onValueChange={(value: any) =>
                  setNewReport({ ...newReport, frequency: value })
                }
              >
                <SelectTrigger id="frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newReport.frequency === "weekly" && (
              <div className="space-y-2">
                <Label htmlFor="day-of-week">Day of Week</Label>
                <Select
                  value={newReport.dayOfWeek?.toString()}
                  onValueChange={(value) =>
                    setNewReport({ ...newReport, dayOfWeek: parseInt(value) })
                  }
                >
                  <SelectTrigger id="day-of-week">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {newReport.frequency === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="day-of-month">Day of Month</Label>
                <Input
                  id="day-of-month"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="1-31"
                  value={newReport.dayOfMonth || ""}
                  onChange={(e) =>
                    setNewReport({
                      ...newReport,
                      dayOfMonth: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="time">Time (24h)</Label>
              <Input
                id="time"
                type="time"
                value={newReport.time}
                onChange={(e) => setNewReport({ ...newReport, time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Recipients</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddRecipient();
                  }
                }}
              />
              <Button type="button" onClick={handleAddRecipient}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            {(newReport.recipients || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {newReport.recipients?.map((email) => (
                  <Badge key={email} variant="secondary">
                    <Mail className="h-3 w-3 mr-1" />
                    {email}
                    <button
                      onClick={() => handleRemoveRecipient(email)}
                      className="ml-2 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleCreateSchedule} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Create Schedule
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Active Schedules</h3>
        {scheduledReports.map((report) => (
          <Card key={report.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold">{report.name}</h4>
                    <Badge variant={report.enabled ? "default" : "secondary"}>
                      {report.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {getFrequencyLabel(report)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {report.recipients.length} recipient(s)
                    </div>
                  </div>
                  {report.lastRun && (
                    <p className="text-xs text-muted-foreground">
                      Last run: {new Date(report.lastRun).toLocaleString()}
                    </p>
                  )}
                  {report.nextRun && (
                    <p className="text-xs text-muted-foreground">
                      Next run: {new Date(report.nextRun).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={report.enabled}
                    onCheckedChange={(checked) =>
                      handleToggleSchedule(report.id, checked as boolean)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSchedule(report.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
