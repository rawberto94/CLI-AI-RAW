"use client";

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Brain, 
  Zap, 
  FileText, 
  Upload, 
  Search, 
  TrendingUp,
  Shield, 
  CheckCircle, 
  ArrowRight, 
  Play, 
  Pause,
  RotateCcw,
  Lightbulb,
  Target,
  Rocket,
  Wand2,
  Heart,
  Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  completed: boolean;
  aiTip?: string;
  estimatedTime?: string;
}

interface UserProgress {
  currentStep: number;
  completedSteps: string[];
  totalProgress: number;
  userType: 'beginner' | 'intermediate' | 'expert';
}

export function GuidedOnboarding() {
  const [progress, setProgress] = useState<UserProgress>({
    currentStep: 0,
    completedSteps: [],
    totalProgress: 0,
    userType: 'beginner'
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to the Future of Contract Management',
      description: 'Let\'s get you started with AI-powered contract intelligence',
      icon: <Sparkles className="w-6 h-6 text-white" />,
      aiTip: 'I\'m your AI assistant and I\'ll guide you through every step!',
      estimatedTime: '2 min',
      completed: false,
      component: (
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Brain className="w-16 h-16 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
              <Sparkles className="w-4 h-4 text-yellow-800" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-gray-900">Hello! I'm your AI Contract Assistant</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              I'll help you transform how you manage contracts. Together, we'll unlock insights, 
              reduce risks, and save you hours of manual work.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="p-4 bg-blue-50 rounded-lg">
              <Zap className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <h3 className="font-semibold text-blue-900">10x Faster</h3>
              <p className="text-sm text-blue-700">AI processes contracts in seconds</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h3 className="font-semibold text-green-900">95% Accuracy</h3>
              <p className="text-sm text-green-700">Catch risks humans might miss</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-semibold text-purple-900">Smart Insights</h3>
              <p className="text-sm text-purple-700">Get expert recommendations</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'upload',
      title: 'Upload Your First Contract',
      description: 'Let\'s start by analyzing one of your contracts',
      icon: <Upload className="w-6 h-6 text-white" />,
      aiTip: 'Don\'t worry about the format - I can read PDFs, Word docs, and more!',
      estimatedTime: '1 min',
      completed: false,
      component: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Upload className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your First Contract</h2>
            <p className="text-gray-600">I'll analyze it and show you what I can discover</p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center bg-gradient-to-br from-blue-50 to-purple-50 hover:border-blue-400 transition-colors cursor-pointer group">
              <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Drop your contract here</h3>
              <p className="text-gray-600 mb-4">or click to browse files</p>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Choose File
              </Button>
            </div>
            
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Pro Tip</h4>
                  <p className="text-sm text-yellow-700">
                    Start with a contract you know well - it's easier to see how accurate my analysis is!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'complete',
      title: 'You\'re All Set!',
      description: 'Welcome to the future of contract management',
      icon: <Rocket className="w-6 h-6 text-white" />,
      aiTip: 'I\'m always here to help - just ask me anything!',
      estimatedTime: '1 min',
      completed: false,
      component: (
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <Rocket className="w-16 h-16 text-white" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-gray-900">Congratulations! 🎉</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              You're now ready to revolutionize your contract management with AI. 
              I'm excited to help you save time, reduce risks, and unlock insights!
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Rocket className="w-5 h-5 mr-2" />
              Start Exploring
            </Button>
            <Button size="lg" variant="outline">
              <Heart className="w-5 h-5 mr-2" />
              Take a Tour
            </Button>
          </div>
        </div>
      )
    }
  ];

  const nextStep = () => {
    if (progress.currentStep < onboardingSteps.length - 1) {
      const currentStepId = onboardingSteps[progress.currentStep]?.id ?? '';
      const newProgress = {
        ...progress,
        currentStep: progress.currentStep + 1,
        completedSteps: [...progress.completedSteps, currentStepId],
        totalProgress: ((progress.currentStep + 1) / onboardingSteps.length) * 100
      };
      setProgress(newProgress);
      
      if (newProgress.currentStep === onboardingSteps.length - 1) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }
    }
  };

  const prevStep = () => {
    if (progress.currentStep > 0) {
      setProgress({
        ...progress,
        currentStep: progress.currentStep - 1,
        totalProgress: (progress.currentStep / onboardingSteps.length) * 100
      });
    }
  };

  const currentStepData = onboardingSteps[progress.currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Celebration Animation */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-ping"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`
              }}
            >
              <Star className="w-6 h-6 text-yellow-400" />
            </div>
          ))}
        </div>
      )}
      
      {/* Progress Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Contract Intelligence Setup</h1>
                <p className="text-gray-600">Step {progress.currentStep + 1} of {onboardingSteps.length}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge className="bg-blue-100 text-blue-800">
                {currentStepData.estimatedTime}
              </Badge>
            </div>
          </div>
          
          <Progress value={progress.totalProgress} className="w-full" />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Step Navigation */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Your Journey
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {onboardingSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      index === progress.currentStep
                        ? 'bg-blue-100 border-2 border-blue-300'
                        : progress.completedSteps.includes(step.id)
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => setProgress({ ...progress, currentStep: index })}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      index === progress.currentStep
                        ? 'bg-blue-600 text-white'
                        : progress.completedSteps.includes(step.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {progress.completedSteps.includes(step.id) ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium text-sm ${
                        index === progress.currentStep ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {step.title}
                      </h3>
                      <p className="text-xs text-gray-600 truncate">{step.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Step Content */}
          <div className="lg:col-span-3">
            <Card className="min-h-[600px]">
              <CardContent className="p-8">
                {/* Step Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    {currentStepData.icon}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {currentStepData.title}
                    </h2>
                    <p className="text-gray-600">{currentStepData.description}</p>
                  </div>
                </div>

                {/* AI Tip */}
                {currentStepData.aiTip && (
                  <div className="mb-8 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Brain className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-purple-900 mb-1">AI Assistant</h4>
                        <p className="text-purple-800 text-sm">{currentStepData.aiTip}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step Component */}
                <div className="mb-8">
                  {currentStepData.component}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={progress.currentStep === 0}
                    className="flex items-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {progress.currentStep + 1} of {onboardingSteps.length}
                    </span>
                  </div>
                  
                  <Button
                    onClick={nextStep}
                    disabled={progress.currentStep === onboardingSteps.length - 1}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {progress.currentStep === onboardingSteps.length - 1 ? 'Complete' : 'Next'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}