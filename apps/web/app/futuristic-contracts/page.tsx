"use client";

import React, { useState, useEffect } from 'react';

import { 
  Brain, 
  Sparkles, 
  Rocket, 
  Search, 
  TrendingUp,
  Zap,
  Settings,
  Bell,
  Menu,
  X,
  ChevronRight,
  Lightbulb,
  Briefcase
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GuidedOnboarding } from '@/components/futuristic/GuidedOnboarding';
import { SmartContractDiscovery } from '@/components/futuristic/SmartContractDiscovery';
import { PredictiveDashboard } from '@/components/futuristic/PredictiveDashboard';
import { CTODemoDashboard } from '@/components/futuristic/CTODemoDashboard';
import { ProcurementBPODashboard } from '@/components/futuristic/ProcurementBPODashboard';
import { RealTimeProcessingDemo } from '@/components/futuristic/RealTimeProcessingDemo';
import { ConversationalSearch } from '@/components/futuristic/ConversationalSearch';

type ViewMode = 'onboarding' | 'dashboard' | 'cto-demo' | 'bpo-demo' | 'processing' | 'discovery' | 'chat' | 'analytics';

interface UserProfile {
  name: string;
  role: string;
  avatar: string;
  isNewUser: boolean;
  completedOnboarding: boolean;
}

export default function FuturisticContractsPage() {
  const [currentView, setCurrentView] = useState<ViewMode>('onboarding');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Alex Johnson',
    role: 'Contract Manager',
    avatar: '👤',
    isNewUser: true,
    completedOnboarding: false
  });

  // Auto-detect if user should see onboarding
  useEffect(() => {
    if (!userProfile.completedOnboarding && userProfile.isNewUser) {
      setCurrentView('onboarding');
    } else {
      setCurrentView('bpo-demo');
    }
  }, [userProfile]);

  const navigationItems = [
    {
      id: 'bpo-demo' as ViewMode,
      name: 'BPO Intelligence',
      icon: <Briefcase className="w-5 h-5" />,
      description: 'Procurement BPO transformation',
      badge: 'Revolutionary'
    },
    {
      id: 'cto-demo' as ViewMode,
      name: 'Executive Dashboard',
      icon: <Rocket className="w-5 h-5" />,
      description: 'CTO-ready business intelligence',
      badge: 'Demo Ready'
    },
    {
      id: 'processing' as ViewMode,
      name: 'Live Processing',
      icon: <Zap className="w-5 h-5" />,
      description: 'Real-time AI contract analysis',
      badge: 'Live Demo'
    },
    {
      id: 'dashboard' as ViewMode,
      name: 'AI Dashboard',
      icon: <TrendingUp className="w-5 h-5" />,
      description: 'Predictive insights & analytics',
      badge: '3 alerts'
    },
    {
      id: 'discovery' as ViewMode,
      name: 'Smart Discovery',
      icon: <Search className="w-5 h-5" />,
      description: 'AI-powered contract search',
      badge: 'New'
    },
    {
      id: 'chat' as ViewMode,
      name: 'AI Assistant',
      icon: <Brain className="w-5 h-5" />,
      description: 'Conversational contract analysis',
      badge: null
    }
  ];

  const renderCurrentView = () => {
    switch (currentView) {
      case 'onboarding':
        return <GuidedOnboarding />;
      case 'bpo-demo':
        return <ProcurementBPODashboard />;
      case 'cto-demo':
        return <CTODemoDashboard />;
      case 'processing':
        return <RealTimeProcessingDemo />;
      case 'dashboard':
        return <PredictiveDashboard />;
      case 'discovery':
        return <SmartContractDiscovery />;
      case 'chat':
        return <ConversationalSearch />;
      default:
        return <ProcurementBPODashboard />;
    }
  };

  // Don't show sidebar for onboarding
  if (currentView === 'onboarding') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {renderCurrentView()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
      {/* Futuristic Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-20'} transition-all duration-300 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 flex flex-col`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              {sidebarOpen && (
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Contract AI</h1>
                  <p className="text-sm text-gray-600">Intelligent Management</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hover:bg-gray-100"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* User Profile */}
        {sidebarOpen && (
          <div className="p-6 border-b border-gray-200/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-lg">
                {userProfile.avatar}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{userProfile.name}</h3>
                <p className="text-sm text-gray-600">{userProfile.role}</p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600">247</div>
                <div className="text-xs text-gray-600">Contracts</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-600">94%</div>
                <div className="text-xs text-gray-600">AI Score</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full p-4 rounded-xl transition-all duration-200 text-left group ${
                currentView === item.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  currentView === item.id
                    ? 'bg-white/20'
                    : 'bg-gray-100 group-hover:bg-gray-200'
                }`}>
                  {item.icon}
                </div>
                
                {sidebarOpen && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{item.name}</h3>
                      {(item.badge != null) && (
                        <Badge className={`text-xs ${
                          currentView === item.id
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm ${
                      currentView === item.id ? 'text-white/80' : 'text-gray-500'
                    }`}>
                      {item.description}
                    </p>
                  </div>
                )}
                
                {sidebarOpen && (
                  <ChevronRight className={`w-4 h-4 transition-transform ${
                    currentView === item.id ? 'rotate-90' : ''
                  }`} />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* AI Assistant Quick Access */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200/50">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">AI Assistant</span>
              </div>
              <p className="text-xs text-purple-700 mb-3">
                Ask me anything about your contracts!
              </p>
              <Button 
                size="sm" 
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => setCurrentView('chat')}
              >
                <Brain className="w-3 h-3 mr-2" />
                Start Chat
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200/50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Contract AI v2.0</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Settings className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Bell className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {currentView === 'bpo-demo' && (
                  <>
                    <Briefcase className="w-6 h-6 text-purple-600" />
                    BPO Intelligence Platform
                  </>
                )}
                {currentView === 'cto-demo' && (
                  <>
                    <Rocket className="w-6 h-6 text-blue-600" />
                    Executive Dashboard
                  </>
                )}
                {currentView === 'processing' && (
                  <>
                    <Zap className="w-6 h-6 text-purple-600" />
                    Live Processing Demo
                  </>
                )}
                {currentView === 'dashboard' && (
                  <>
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                    AI Dashboard
                  </>
                )}
                {currentView === 'discovery' && (
                  <>
                    <Search className="w-6 h-6 text-purple-600" />
                    Smart Discovery
                  </>
                )}
                {currentView === 'chat' && (
                  <>
                    <Brain className="w-6 h-6 text-green-600" />
                    AI Assistant
                  </>
                )}
              </h1>
              <p className="text-gray-600">
                {currentView === 'bpo-demo' && 'Revolutionary AI-powered procurement intelligence for BPO transformation'}
                {currentView === 'cto-demo' && 'Executive-ready business intelligence and strategic insights'}
                {currentView === 'processing' && 'Watch AI analyze contracts in real-time with parallel processing'}
                {currentView === 'dashboard' && 'Real-time insights and predictive analytics'}
                {currentView === 'discovery' && 'Find contracts with natural language queries'}
                {currentView === 'chat' && 'Conversational contract analysis and insights'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Quick Actions */}
              <Button variant="outline" size="sm">
                <Lightbulb className="w-4 h-4 mr-2" />
                Tips
              </Button>
              
              {/* Onboarding Access */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentView('onboarding')}
              >
                <Rocket className="w-4 h-4 mr-2" />
                Setup Guide
              </Button>
              
              {/* AI Status */}
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-700 font-medium">AI Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {renderCurrentView()}
        </div>
      </div>
    </div>
  );
}