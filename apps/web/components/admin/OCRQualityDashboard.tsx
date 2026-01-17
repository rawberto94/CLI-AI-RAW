'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Shield,
  Globe,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  Eye,
  Lock,
  Server,
  TrendingUp,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface OCRProvider {
  id: string;
  name: string;
  configured: boolean;
  region: string;
  dataResidency: string;
  accuracy: number;
  speed: string;
  cost: string;
  compliance: string[];
  features: string[];
}

interface OCRSettings {
  defaultProvider: string;
  preprocessingEnabled: boolean;
  preprocessingPreset: 'fast' | 'balanced' | 'quality';
  autoSelectProvider: boolean;
  fallbackChain: string[];
  confidenceThreshold: number;
  enableCaching: boolean;
  maxRetries: number;
}

interface OCRStats {
  configuredProviders: number;
  totalProviders: number;
  gdprCompliantCount: number;
  swissCompliantCount: number;
}

// ============================================================================
// Component
// ============================================================================

export function OCRQualityDashboard() {
  const [providers, setProviders] = useState<OCRProvider[]>([]);
  const [settings, setSettings] = useState<OCRSettings | null>(null);
  const [stats, setStats] = useState<OCRStats | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; responseTimeMs: number }>>({});

  // Load OCR configuration
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ocr/settings');
      const data = await response.json();
      if (data.success) {
        setProviders(data.data.providers);
        setSettings(data.data.settings);
        setStats(data.data.stats);
        setRecommendations(data.data.recommendations);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const testProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const response = await fetch('/api/ocr/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });
      const data = await response.json();
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          success: data.success && data.data.success,
          message: data.data?.message || 'Unknown error',
          responseTimeMs: data.data?.responseTimeMs || 0,
        },
      }));
    } catch {
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          success: false,
          message: 'Connection failed',
          responseTimeMs: 0,
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const updateSettings = async (updates: Partial<OCRSettings>) => {
    if (!settings) return;
    
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    try {
      await fetch('/api/ocr/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });
    } catch {
      // Error handled silently
    }
  };

  const getProviderIcon = (providerId: string) => {
    if (providerId.includes('azure')) return Shield;
    if (providerId.includes('google')) return Globe;
    if (providerId === 'tesseract') return Server;
    if (providerId === 'gpt4') return Eye;
    if (providerId === 'mistral') return Zap;
    return FileText;
  };

  const getComplianceBadgeColor = (compliance: string) => {
    if (compliance.includes('Swiss') || compliance.includes('FADP')) return 'bg-red-100 text-red-800';
    if (compliance.includes('GDPR')) return 'bg-blue-100 text-blue-800';
    if (compliance.includes('SecNum') || compliance.includes('FINMA')) return 'bg-purple-100 text-purple-800';
    if (compliance.includes('ISO') || compliance.includes('SOC')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-lg">Loading OCR configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">OCR Quality & Security</h2>
          <p className="text-muted-foreground">
            Configure OCR providers, preprocessing, and data compliance
          </p>
        </div>
        <Button onClick={loadConfiguration} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Configured Providers</p>
                  <p className="text-2xl font-bold">{stats.configuredProviders}/{stats.totalProviders}</p>
                </div>
                <Settings className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">GDPR Compliant</p>
                  <p className="text-2xl font-bold">{stats.gdprCompliantCount}</p>
                </div>
                <Shield className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Swiss Compliant</p>
                  <p className="text-2xl font-bold">{stats.swissCompliantCount}</p>
                </div>
                <Lock className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accuracy Range</p>
                  <p className="text-2xl font-bold">85-98%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* OCR Providers */}
      <Card>
        <CardHeader>
          <CardTitle>OCR Providers</CardTitle>
          <CardDescription>
            Configure and test available OCR providers for document processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {providers.map((provider) => {
              const Icon = getProviderIcon(provider.id);
              const testResult = testResults[provider.id];
              
              return (
                <div
                  key={provider.id}
                  className={cn(
                    'p-4 rounded-lg border',
                    provider.configured
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        provider.configured ? 'bg-green-100' : 'bg-gray-100'
                      )}>
                        <Icon className={cn(
                          'h-5 w-5',
                          provider.configured ? 'text-green-600' : 'text-gray-400'
                        )} />
                      </div>
                      <div>
                        <h4 className="font-medium">{provider.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {provider.region}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {provider.configured ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {/* Metrics */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Accuracy</span>
                      <span className="font-medium">{provider.accuracy}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Speed</span>
                      <span className="font-medium capitalize">{provider.speed}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cost</span>
                      <span className="font-medium">{provider.cost}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Data Residency</span>
                      <Badge variant="outline">{provider.dataResidency}</Badge>
                    </div>

                    {/* Compliance badges */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {provider.compliance.map((c, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className={cn('text-xs', getComplianceBadgeColor(c))}
                        >
                          {c}
                        </Badge>
                      ))}
                    </div>

                    {/* Features */}
                    <div className="text-xs text-muted-foreground">
                      Features: {provider.features.join(', ')}
                    </div>

                    {/* Test button */}
                    {provider.configured && (
                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testProvider(provider.id)}
                          disabled={testingProvider === provider.id}
                          className="w-full"
                        >
                          {testingProvider === provider.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            'Test Connection'
                          )}
                        </Button>
                        {testResult && (
                          <div className={cn(
                            'mt-2 p-2 rounded text-xs',
                            testResult.success
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          )}>
                            {testResult.success ? '✓' : '✗'} {testResult.message}
                            {testResult.responseTimeMs > 0 && (
                              <span className="ml-2">({testResult.responseTimeMs}ms)</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Settings</CardTitle>
            <CardDescription>
              Configure OCR processing behavior and quality settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default Provider */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Default OCR Provider</Label>
                <p className="text-sm text-muted-foreground">
                  Primary provider for document processing
                </p>
              </div>
              <Select
                value={settings.defaultProvider}
                onValueChange={(value) => updateSettings({ defaultProvider: value })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.filter(p => p.configured).map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preprocessing */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Document Preprocessing</Label>
                <p className="text-sm text-muted-foreground">
                  Enhance images before OCR for better accuracy
                </p>
              </div>
              <Switch
                checked={settings.preprocessingEnabled}
                onCheckedChange={(checked) => updateSettings({ preprocessingEnabled: checked })}
              />
            </div>

            {settings.preprocessingEnabled && (
              <div className="flex items-center justify-between pl-4 border-l-2">
                <div>
                  <Label>Preprocessing Quality</Label>
                  <p className="text-sm text-muted-foreground">
                    Higher quality = better accuracy but slower
                  </p>
                </div>
                <Select
                  value={settings.preprocessingPreset}
                  onValueChange={(value: 'fast' | 'balanced' | 'quality') => 
                    updateSettings({ preprocessingPreset: value })
                  }
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">Fast</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Auto-select provider */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Smart Provider Selection</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically choose best provider based on document
                </p>
              </div>
              <Switch
                checked={settings.autoSelectProvider}
                onCheckedChange={(checked) => updateSettings({ autoSelectProvider: checked })}
              />
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Confidence Threshold</Label>
                  <p className="text-sm text-muted-foreground">
                    Minimum confidence for auto-applying extracted data
                  </p>
                </div>
                <span className="font-medium">{Math.round(settings.confidenceThreshold * 100)}%</span>
              </div>
              <Slider
                value={[settings.confidenceThreshold * 100]}
                onValueChange={([value]) => updateSettings({ confidenceThreshold: (value ?? 50) / 100 })}
                min={50}
                max={99}
                step={5}
                className="w-full"
              />
            </div>

            {/* Caching */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Result Caching</Label>
                <p className="text-sm text-muted-foreground">
                  Cache OCR results to avoid reprocessing
                </p>
              </div>
              <Switch
                checked={settings.enableCaching}
                onCheckedChange={(checked) => updateSettings({ enableCaching: checked })}
              />
            </div>

            {/* Max Retries */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Max Retries</Label>
                <p className="text-sm text-muted-foreground">
                  Retry attempts on OCR failure
                </p>
              </div>
              <Select
                value={settings.maxRetries.toString()}
                onValueChange={(value) => updateSettings({ maxRetries: parseInt(value, 10) })}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Document Quality Guidelines
          </CardTitle>
          <CardDescription>
            Tips for optimal OCR accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2 text-green-700">✓ Best Practices</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Use native PDFs when possible (not scanned)</li>
                <li>• Scan documents at 300 DPI or higher</li>
                <li>• Ensure good lighting and contrast</li>
                <li>• Keep documents flat and properly aligned</li>
                <li>• Use Azure Switzerland for GDPR/FADP compliance</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-red-700">✗ Avoid</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Low-resolution scans (&lt;150 DPI)</li>
                <li>• Heavily skewed or rotated documents</li>
                <li>• Poor lighting or washed-out scans</li>
                <li>• Crumpled or folded documents</li>
                <li>• Handwritten text (use specialized providers)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default OCRQualityDashboard;
