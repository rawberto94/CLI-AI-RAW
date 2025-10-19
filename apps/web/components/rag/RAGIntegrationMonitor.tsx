"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Activity,
  Clock,
  TrendingUp,
  Database
} from "lucide-react";

interface RAGIntegrationStatus {
  health: {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  };
  metrics: {
    totalIndexed: number;
    totalFailed: number;
    totalRetries: number;
    avgProcessingTime: number;
    queueSize: number;
    config: any;
  };
  queue: Array<{
    key: string;
    retries: number;
    lastAttempt: string;
    nextRetryIn: number;
  }>;
}

export function RAGIntegrationMonitor() {
  const [status, setStatus] = useState<RAGIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await fetch("/api/rag/integration");
      
      if (!response.ok) {
        throw new Error("Failed to fetch RAG integration status");
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-50";
      case "degraded":
        return "text-yellow-600 bg-yellow-50";
      case "unhealthy":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading RAG integration status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">RAG Integration Monitor</h2>
          <p className="text-gray-600">Real-time monitoring of RAG system integration</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-pulse" : ""}`} />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchStatus}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(status.health.status)}
            System Health
          </CardTitle>
          <CardDescription>Overall RAG integration health status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge className={getStatusColor(status.health.status)}>
                {status.health.status.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Integration Enabled</span>
              <Badge variant={status.metrics.config.enabled ? "default" : "secondary"}>
                {status.metrics.config.enabled ? "YES" : "NO"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Auto-indexing</span>
              <Badge variant={status.metrics.config.autoIndexOnUpload ? "default" : "secondary"}>
                {status.metrics.config.autoIndexOnUpload ? "ENABLED" : "DISABLED"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Indexed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-green-600">
                {status.metrics.totalIndexed}
              </span>
              <CheckCircle2 className="h-8 w-8 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-red-600">
                {status.metrics.totalFailed}
              </span>
              <XCircle className="h-8 w-8 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Processing Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-blue-600">
                {Math.round(status.metrics.avgProcessingTime)}ms
              </span>
              <Clock className="h-8 w-8 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Retry Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-yellow-600">
                {status.metrics.queueSize}
              </span>
              <Database className="h-8 w-8 text-yellow-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retry Queue */}
      {status.queue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Retry Queue</CardTitle>
            <CardDescription>
              Contracts waiting for retry after failed indexing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.queue.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">{item.key}</p>
                    <p className="text-xs text-gray-600">
                      Last attempt: {new Date(item.lastAttempt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">Retry {item.retries}</Badge>
                    <p className="text-xs text-gray-600 mt-1">
                      Next retry in {Math.round(item.nextRetryIn / 1000)}s
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Current RAG integration settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Max Retries</p>
              <p className="text-lg font-semibold">{status.metrics.config.maxRetries}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Retry Delay</p>
              <p className="text-lg font-semibold">{status.metrics.config.retryDelayMs}ms</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Timeout</p>
              <p className="text-lg font-semibold">{status.metrics.config.timeoutMs}ms</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Fail Silently</p>
              <p className="text-lg font-semibold">
                {status.metrics.config.failSilently ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Success Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Success Rate</span>
              <span className="text-lg font-bold">
                {status.metrics.totalIndexed + status.metrics.totalFailed > 0
                  ? Math.round(
                      (status.metrics.totalIndexed /
                        (status.metrics.totalIndexed + status.metrics.totalFailed)) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{
                  width: `${
                    status.metrics.totalIndexed + status.metrics.totalFailed > 0
                      ? (status.metrics.totalIndexed /
                          (status.metrics.totalIndexed + status.metrics.totalFailed)) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
