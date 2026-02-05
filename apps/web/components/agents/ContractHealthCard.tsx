'use client';

/**
 * Contract Health Card
 * Displays contract health score and issues
 */

import { motion } from 'framer-motion';
import {
  Heart,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown as _TrendingDown,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ContractHealthProps {
  contractId: string;
  health: {
    score: number;
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    issues: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }>;
    predictions: Array<{
      type: string;
      probability: number;
      description: string;
      impact: 'low' | 'medium' | 'high' | 'critical';
    }>;
    recommendations: Array<{
      action: string;
      priority: string;
      description: string;
    }>;
  };
  onAutoFix?: () => void;
}

export function ContractHealthCard({ contractId: _contractId, health, onAutoFix }: ContractHealthProps) {
  const getHealthColor = (healthLevel: string) => {
    switch (healthLevel) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-violet-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthBg = (healthLevel: string) => {
    switch (healthLevel) {
      case 'excellent': return 'bg-green-100';
      case 'good': return 'bg-violet-100';
      case 'fair': return 'bg-yellow-100';
      case 'poor': return 'bg-orange-100';
      case 'critical': return 'bg-red-100';
      default: return 'bg-gray-100';
    }
  };

  const getHealthIcon = (healthLevel: string) => {
    switch (healthLevel) {
      case 'excellent':
      case 'good':
        return <CheckCircle2 className="h-5 w-5" />;
      case 'fair':
        return <Activity className="h-5 w-5" />;
      case 'poor':
        return <AlertTriangle className="h-5 w-5" />;
      case 'critical':
        return <XCircle className="h-5 w-5" />;
      default:
        return <Heart className="h-5 w-5" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const autoFixableCount = health.recommendations.filter(r => 
    r.priority === 'high' || r.priority === 'urgent'
  ).length;

  return (
    <Card>
      <CardHeader className="p-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2.5">
            <Heart className="h-4 w-4 text-red-500" />
            Contract Health
          </CardTitle>
          {autoFixableCount > 0 && onAutoFix && (
            <Button size="sm" variant="outline" onClick={onAutoFix} className="h-7 text-xs">
              Auto-Fix ({autoFixableCount})
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        {/* Health Score */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className={`${getHealthColor(health.overallHealth)} ${getHealthBg(health.overallHealth)} p-2 rounded-lg`}>
                {getHealthIcon(health.overallHealth)}
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{health.score}/100</div>
                <div className={`text-xs font-medium uppercase ${getHealthColor(health.overallHealth)}`}>
                  {health.overallHealth}
                </div>
              </div>
            </div>
          </div>
          
          <Progress value={health.score} className="h-2" />
        </div>

        {/* Issues */}
        {health.issues.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2.5">
              Issues ({health.issues.length})
            </h4>
            <div className="space-y-2">
              {health.issues.slice(0, 3).map((issue, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg"
                >
                  <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                    issue.severity === 'critical' ? 'text-red-500' :
                    issue.severity === 'high' ? 'text-orange-500' :
                    issue.severity === 'medium' ? 'text-yellow-500' :
                    'text-gray-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={getSeverityBadge(issue.severity)} className="px-2 py-0 text-xs">
                        {issue.severity}
                      </Badge>
                      <span className="text-xs text-gray-600">{issue.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-gray-700">{issue.message}</p>
                  </div>
                </motion.div>
              ))}
              {health.issues.length > 3 && (
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs">
                  View All {health.issues.length} Issues
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Predictions */}
        {health.predictions.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-violet-600" />
              Predictions
            </h4>
            <div className="space-y-2">
              {health.predictions.slice(0, 2).map((prediction, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-2.5 border border-violet-200 bg-violet-50 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-600" />
                      <span className="text-xs font-medium text-violet-900">
                        {(prediction.probability * 100).toFixed(0)}% probability
                      </span>
                    </div>
                    <Badge variant="outline" className="px-2 py-0 text-xs border-violet-300 text-violet-700">
                      {prediction.impact} impact
                    </Badge>
                  </div>
                  <p className="text-xs text-violet-800">{prediction.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Top Recommendations */}
        {health.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2.5">
              Recommendations
            </h4>
            <div className="space-y-2">
              {health.recommendations.slice(0, 2).map((rec, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-2.5 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-green-900 mb-0.5">
                        {rec.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-green-700">{rec.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {health.issues.length === 0 && health.predictions.length === 0 && (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">All systems healthy!</p>
            <p className="text-xs text-gray-500 mt-1">No issues or risks detected</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
