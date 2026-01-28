'use client';

/**
 * Agent Status Widget
 * Displays real-time agent activity and recommendations
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Brain, 
  CheckCircle2, 
  AlertTriangle,
  TrendingUp,
  Zap,
  Clock,
  DollarSign,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AgentEvent {
  id: string;
  agentName: string;
  eventType: string;
  timestamp: Date;
  outcome: 'success' | 'failure' | 'partial' | 'pending';
  description: string;
  confidence?: number;
  metadata?: {
    duration: number;
    cost?: number;
  };
}

interface AgentRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
  potentialValue?: number;
  effort: 'low' | 'medium' | 'high';
  actions: any[];
}

interface AgentStatusProps {
  contractId: string;
}

export function AgentStatus({ contractId }: AgentStatusProps) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('activity');

  useEffect(() => {
    fetchAgentData();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchAgentData, 10000);
    return () => clearInterval(interval);
  }, [contractId]);

  const fetchAgentData = async () => {
    try {
      const response = await fetch(`/api/agents/status?contractId=${contractId}`);
      const data = await response.json();
      
      setEvents(data.events || []);
      setRecommendations(data.recommendations || []);
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  };

  const getAgentIcon = (agentName: string) => {
    if (agentName.includes('validation')) return <Shield className="h-3.5 w-3.5" />;
    if (agentName.includes('gap')) return <Sparkles className="h-3.5 w-3.5" />;
    if (agentName.includes('health')) return <Activity className="h-3.5 w-3.5" />;
    if (agentName.includes('deadline')) return <Clock className="h-3.5 w-3.5" />;
    if (agentName.includes('opportunity')) return <DollarSign className="h-3.5 w-3.5" />;
    if (agentName.includes('workflow')) return <TrendingUp className="h-3.5 w-3.5" />;
    return <Brain className="h-3.5 w-3.5" />;
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'success': return 'text-green-600';
      case 'failure': return 'text-red-600';
      case 'partial': return 'text-yellow-600';
      case 'pending': return 'text-violet-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const formatAgentName = (name: string) => {
    return name
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Card className="flex-1">
      <CardHeader className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="h-4 w-4 text-violet-600" />
            <CardTitle className="text-base">AI Agent Activity</CardTitle>
          </div>
          {!isLoading && events.length > 0 && (
            <Badge variant="secondary" className="px-3 py-1">
              <Activity className="h-3 w-3 mr-1.5" />
              {events.filter(e => e.outcome === 'pending').length} Active
            </Badge>
          )}
        </div>
        <CardDescription className="mt-1.5">
          Autonomous AI agents monitoring and optimizing your contracts
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="activity" className="text-sm">
              Activity
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-sm">
              Recommendations ({recommendations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4">
            <ScrollArea className="h-[400px] pr-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-100 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Brain className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">No agent activity yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Agents will activate automatically as contracts are processed
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {events.map((event, index) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 ${getOutcomeColor(event.outcome)}`}>
                            {getAgentIcon(event.agentName)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900">
                                {formatAgentName(event.agentName)}
                              </span>
                              <Badge variant="outline" className="px-2 py-0 text-xs">
                                {event.eventType.replace(/_/g, ' ')}
                              </Badge>
                              {event.confidence && (
                                <span className="text-xs text-gray-500">
                                  {(event.confidence * 100).toFixed(0)}% confidence
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-600 mt-1">
                              {event.description}
                            </p>
                            
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>{formatTimeAgo(event.timestamp)}</span>
                              {event.metadata?.duration && (
                                <span>{event.metadata.duration}ms</span>
                              )}
                              {event.metadata?.cost && (
                                <span>${event.metadata.cost.toFixed(4)}</span>
                              )}
                            </div>
                          </div>

                          <div className={`${getOutcomeColor(event.outcome)}`}>
                            {event.outcome === 'success' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : event.outcome === 'failure' ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4 animate-pulse" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            <ScrollArea className="h-[400px] pr-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-32 bg-gray-100 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">No recommendations yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    AI agents will suggest optimizations as they analyze your contracts
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {recommendations.map((rec, index) => (
                      <motion.div
                        key={rec.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="p-4 border rounded-lg hover:border-violet-300 transition-colors bg-white"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {rec.title}
                              </h4>
                              <Badge variant={getPriorityColor(rec.priority)} className="px-2 py-0 text-xs">
                                {rec.priority}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-gray-600">
                              {rec.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="h-3 w-3" />
                            <span>Confidence: {(rec.confidence * 100).toFixed(0)}%</span>
                          </div>
                          
                          {rec.potentialValue && (
                            <div className="flex items-center gap-1.5 text-green-600">
                              <DollarSign className="h-3 w-3" />
                              <span>${rec.potentialValue.toLocaleString()} potential value</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            <span>{rec.effort} effort</span>
                          </div>
                        </div>

                        {rec.actions.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <Button size="sm" variant="outline" className="h-7 text-xs">
                              View Actions ({rec.actions.length})
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
