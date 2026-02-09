'use client';

/**
 * Tour Client
 * Comprehensive app tour and learning center for ConTigo
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PlayCircle,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Upload,
  FileSearch,
  MessageSquare,
  Search,
  BarChart3,
  Settings,
  Sparkles,
  Trophy,
  ArrowRight,
  Zap,
  Home,
  FolderOpen,
  ArrowLeftRight,
  GraduationCap,
  BookOpen,
  Rocket,
  Clock,
  Target,
  Shield,
  Brain,
  Lightbulb,
  FileText,
  Star,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ===== Types =====
interface TourStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  features: Array<{ text: string; icon: React.ElementType }>;
  action?: { label: string; href: string };
  gradient: string;
  accentColor: string;
  duration: string;
}

interface LearningModule {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  completed?: boolean;
  locked?: boolean;
  topics: string[];
  href: string;
}

interface FeatureGuide {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  href: string;
  isNew?: boolean;
}

// ===== Data =====
const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ConTigo',
    subtitle: 'AI-Powered Contract Intelligence',
    description: 'Transform how you manage contracts with advanced AI that understands, analyzes, and automates your contract workflows.',
    icon: Sparkles,
    features: [
      { text: 'Instant AI analysis of any contract', icon: Brain },
      { text: 'Automatic extraction of key terms', icon: Target },
      { text: 'Smart contract health scoring', icon: Shield },
      { text: 'Natural language Q&A', icon: MessageSquare },
    ],
    gradient: 'from-violet-600 via-purple-600 to-purple-600',
    accentColor: 'violet',
    duration: '1 min',
  },
  {
    id: 'dashboard',
    title: 'Your Command Center',
    subtitle: 'Dashboard Overview',
    description: 'Get a bird\'s-eye view of your entire contract portfolio. Monitor key metrics, upcoming deadlines, and contract health at a glance.',
    icon: Home,
    features: [
      { text: 'Portfolio health score', icon: Shield },
      { text: 'Renewal calendar overview', icon: Clock },
      { text: 'Recent activity feed', icon: Zap },
      { text: 'Quick action shortcuts', icon: Rocket },
    ],
    action: { label: 'Go to Dashboard', href: '/dashboard' },
    gradient: 'from-violet-600 via-purple-600 to-purple-600',
    accentColor: 'blue',
    duration: '2 min',
  },
  {
    id: 'upload',
    title: 'Upload Contracts',
    subtitle: 'Effortless Import',
    description: 'Simply drag and drop your contracts. Our AI automatically extracts parties, dates, values, and key terms from any document format.',
    icon: Upload,
    features: [
      { text: 'Drag & drop PDF, DOCX, images', icon: FileText },
      { text: 'Batch upload multiple files', icon: FolderOpen },
      { text: 'AI extracts key information', icon: Brain },
      { text: 'Real-time processing status', icon: Zap },
    ],
    action: { label: 'Upload Contracts', href: '/upload' },
    gradient: 'from-violet-500 via-violet-500 to-purple-500',
    accentColor: 'emerald',
    duration: '2 min',
  },
  {
    id: 'contracts',
    title: 'Contract Library',
    subtitle: 'Centralized Management',
    description: 'All your contracts in one intelligent workspace. Search, filter, organize, and access any contract instantly.',
    icon: FolderOpen,
    features: [
      { text: 'Smart filtering & search', icon: Search },
      { text: 'Grid and list views', icon: BarChart3 },
      { text: 'Star important contracts', icon: Star },
      { text: 'Bulk actions & exports', icon: FileSearch },
    ],
    action: { label: 'Browse Contracts', href: '/contracts' },
    gradient: 'from-violet-500 via-violet-500 to-purple-500',
    accentColor: 'cyan',
    duration: '3 min',
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    subtitle: 'Your Contract Expert',
    description: 'Ask complex questions in plain English. Get instant answers backed by your contract data with full source citations.',
    icon: MessageSquare,
    features: [
      { text: '"Summarize Q3 vendor contracts"', icon: FileText },
      { text: '"What obligations do we have?"', icon: Target },
      { text: '"Compare pricing across MSAs"', icon: ArrowLeftRight },
      { text: '"Find renewal deadlines"', icon: Clock },
    ],
    action: { label: 'Try AI Chat', href: '/ai/chat' },
    gradient: 'from-pink-500 via-rose-500 to-red-500',
    accentColor: 'pink',
    duration: '3 min',
  },
  {
    id: 'search',
    title: 'Smart Search',
    subtitle: 'Find Anything Instantly',
    description: 'Semantic search understands meaning, not just keywords. Find clauses, terms, and provisions across your entire portfolio.',
    icon: Search,
    features: [
      { text: 'Semantic understanding', icon: Brain },
      { text: 'Search by concept or intent', icon: Lightbulb },
      { text: 'Cross-document analysis', icon: FileSearch },
      { text: 'Instant results', icon: Zap },
    ],
    action: { label: 'Try Search', href: '/search' },
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    accentColor: 'amber',
    duration: '2 min',
  },
  {
    id: 'compare',
    title: 'Contract Compare',
    subtitle: 'Side-by-Side Analysis',
    description: 'Compare contracts intelligently. Spot differences, track version changes, and ensure consistency across agreements.',
    icon: ArrowLeftRight,
    features: [
      { text: 'Visual diff highlighting', icon: FileSearch },
      { text: 'Clause-by-clause comparison', icon: Target },
      { text: 'Version history tracking', icon: Clock },
      { text: 'Export comparison reports', icon: FileText },
    ],
    action: { label: 'Compare Contracts', href: '/compare' },
    gradient: 'from-violet-500 via-purple-500 to-violet-500',
    accentColor: 'purple',
    duration: '2 min',
  },
  {
    id: 'analytics',
    title: 'Analytics & Reports',
    subtitle: 'Insights On Demand',
    description: 'Build custom AI-powered reports across your entire portfolio. Visualize trends, track metrics, and export insights.',
    icon: BarChart3,
    features: [
      { text: 'Interactive dashboards', icon: BarChart3 },
      { text: 'AI-generated summaries', icon: Brain },
      { text: 'Custom report builder', icon: FileText },
      { text: 'One-click PDF export', icon: ExternalLink },
    ],
    action: { label: 'View Analytics', href: '/analytics' },
    gradient: 'from-violet-500 via-violet-500 to-purple-500',
    accentColor: 'teal',
    duration: '3 min',
  },
  {
    id: 'complete',
    title: "You're Ready!",
    subtitle: 'Start Your Journey',
    description: 'You\'ve completed the tour! Dive in and discover how ConTigo transforms your contract workflow.',
    icon: Trophy,
    features: [
      { text: 'Upload your first contract', icon: Upload },
      { text: 'Ask AI about your documents', icon: MessageSquare },
      { text: 'Build a custom report', icon: BarChart3 },
      { text: 'Explore the dashboard', icon: Home },
    ],
    action: { label: "Let's Go!", href: '/' },
    gradient: 'from-yellow-500 via-amber-500 to-orange-500',
    accentColor: 'amber',
    duration: '1 min',
  },
];

const learningModules: LearningModule[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of ConTigo and set up your workspace',
    icon: Rocket,
    duration: '15 min',
    level: 'beginner',
    topics: ['Account setup', 'First upload', 'Basic navigation', 'Quick wins'],
    href: '/tour?tab=tour',
  },
  {
    id: 'ai-mastery',
    title: 'AI Mastery',
    description: 'Master the AI assistant and get the most out of contract intelligence',
    icon: Brain,
    duration: '20 min',
    level: 'intermediate',
    topics: ['Effective prompts', 'Complex queries', 'Citation review', 'Batch analysis'],
    href: '/ai/chat',
  },
  {
    id: 'advanced-search',
    title: 'Advanced Search Techniques',
    description: 'Power-user tips for finding exactly what you need',
    icon: Search,
    duration: '15 min',
    level: 'intermediate',
    topics: ['Semantic search', 'Filters & operators', 'Saved searches', 'Bulk operations'],
    href: '/search',
  },
  {
    id: 'analytics-reporting',
    title: 'Analytics & Reporting',
    description: 'Build custom reports and gain insights from your portfolio',
    icon: BarChart3,
    duration: '25 min',
    level: 'advanced',
    topics: ['Dashboard setup', 'Custom reports', 'Trend analysis', 'Export options'],
    href: '/analytics',
  },
  {
    id: 'team-collaboration',
    title: 'Team Collaboration',
    description: 'Work effectively with your team on contracts',
    icon: GraduationCap,
    duration: '15 min',
    level: 'intermediate',
    locked: true,
    topics: ['Sharing contracts', 'Comments & notes', 'Approval workflows', 'Permissions'],
    href: '/settings',
  },
  {
    id: 'integrations',
    title: 'Integrations & API',
    description: 'Connect ConTigo with your existing tools and workflows',
    icon: Zap,
    duration: '30 min',
    level: 'advanced',
    locked: true,
    topics: ['API access', 'Webhooks', 'CRM integration', 'Automation'],
    href: '/integrations',
  },
];

const featureGuides: FeatureGuide[] = [
  { id: 'upload', title: 'Upload Contracts', description: 'Learn how to upload and process contracts', icon: Upload, category: 'Basics', href: '/upload' },
  { id: 'browse', title: 'Browse & Organize', description: 'Navigate and organize your contract library', icon: FolderOpen, category: 'Basics', href: '/contracts' },
  { id: 'ai-chat', title: 'AI Chat Assistant', description: 'Ask questions and get instant answers', icon: MessageSquare, category: 'AI Features', href: '/ai/chat', isNew: true },
  { id: 'search', title: 'Smart Search', description: 'Find anything with semantic search', icon: Search, category: 'AI Features', href: '/search' },
  { id: 'compare', title: 'Contract Compare', description: 'Compare contracts side by side', icon: ArrowLeftRight, category: 'Analysis', href: '/compare' },
  { id: 'analytics', title: 'Analytics Dashboard', description: 'View insights and reports', icon: BarChart3, category: 'Analysis', href: '/analytics' },
  { id: 'settings', title: 'Account Settings', description: 'Manage your preferences', icon: Settings, category: 'Settings', href: '/settings' },
  { id: 'keyboard', title: 'Keyboard Shortcuts', description: 'Speed up your workflow', icon: Zap, category: 'Tips', href: '/settings#shortcuts' },
];

// ===== Storage Keys =====
const TOUR_PROGRESS_KEY = 'contigo_tour_progress';
const TOUR_COMPLETED_KEY = 'contigo_tour_completed';

// ===== Components =====

function InteractiveTour() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const step = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;
  const isLastStep = currentStep === tourSteps.length - 1;
  const Icon = step.icon;

  // Load saved progress
  useEffect(() => {
    const saved = localStorage.getItem(TOUR_PROGRESS_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCompletedSteps(new Set(data.completedSteps || []));
        if (data.currentStep !== undefined && data.currentStep < tourSteps.length) {
          setCurrentStep(data.currentStep);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save progress
  useEffect(() => {
    localStorage.setItem(TOUR_PROGRESS_KEY, JSON.stringify({
      completedSteps: Array.from(completedSteps),
      currentStep,
    }));
  }, [completedSteps, currentStep]);

  const handleNext = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setDirection('next');
    setCompletedSteps(prev => new Set([...prev, step.id]));
    
    if (isLastStep) {
      localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      localStorage.removeItem(TOUR_PROGRESS_KEY);
      router.push('/');
    } else {
      setCurrentStep(prev => prev + 1);
    }
    setTimeout(() => setIsAnimating(false), 400);
  }, [isAnimating, isLastStep, router, step.id]);

  const handlePrev = useCallback(() => {
    if (isAnimating || currentStep <= 0) return;
    setIsAnimating(true);
    setDirection('prev');
    setCurrentStep(prev => prev - 1);
    setTimeout(() => setIsAnimating(false), 400);
  }, [currentStep, isAnimating]);

  const handleStepClick = useCallback((index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setDirection(index > currentStep ? 'next' : 'prev');
    setCurrentStep(index);
    setTimeout(() => setIsAnimating(false), 400);
  }, [currentStep, isAnimating]);

  const handleAction = useCallback(() => {
    if (step.action) {
      setCompletedSteps(prev => new Set([...prev, step.id]));
      router.push(step.action.href);
    }
  }, [router, step]);

  const resetTour = useCallback(() => {
    setCompletedSteps(new Set());
    setCurrentStep(0);
    localStorage.removeItem(TOUR_PROGRESS_KEY);
    localStorage.removeItem(TOUR_COMPLETED_KEY);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  const variants = {
    enter: (dir: 'next' | 'prev') => ({
      x: dir === 'next' ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: 'next' | 'prev') => ({
      x: dir === 'next' ? -100 : 100,
      opacity: 0,
    }),
  };

  return (
    <div className="space-y-8">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-2xl bg-gradient-to-br text-white shadow-lg",
            step.gradient
          )}>
            <PlayCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Interactive App Tour</h2>
            <p className="text-sm text-slate-500">Step {currentStep + 1} of {tourSteps.length} • {step.duration}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetTour}>
            Restart Tour
          </Button>
          {completedSteps.size > 0 && (
            <Badge variant="secondary" className="bg-violet-100 text-violet-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {completedSteps.size} completed
            </Badge>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between">
          {tourSteps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleStepClick(i)}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all",
                completedSteps.has(s.id) 
                  ? "bg-violet-500 text-white"
                  : i === currentStep
                    ? `bg-gradient-to-br ${step.gradient} text-white shadow-lg`
                    : "bg-slate-200 text-slate-500 hover:bg-slate-300"
              )}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
            >
              {completedSteps.has(s.id) ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="grid lg:grid-cols-2 gap-8"
        >
          {/* Left: Visual */}
          <div className={cn(
            "relative rounded-3xl p-8 bg-gradient-to-br text-white overflow-hidden min-h-[400px] flex flex-col justify-center",
            step.gradient
          )}>
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 50%)'
              }} />
            </div>
            
            {/* Floating Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="relative z-10"
            >
              <div className="inline-flex p-6 bg-white/20 backdrop-blur-xl rounded-3xl shadow-2xl">
                <Icon className="h-16 w-16" />
              </div>
            </motion.div>
            
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 text-3xl font-bold relative z-10"
            >
              {step.title}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-2 text-lg text-white/80 relative z-10"
            >
              {step.subtitle}
            </motion.p>
          </div>

          {/* Right: Details */}
          <div className="space-y-6">
            <div>
              <p className="text-lg text-slate-600 leading-relaxed">
                {step.description}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Key Features</h4>
              <div className="grid gap-3">
                {step.features.map((feature, i) => {
                  const FeatureIcon = feature.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i + 0.5 }}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                    >
                      <div className={cn(
                        "p-2 rounded-lg bg-gradient-to-br text-white",
                        step.gradient
                      )}>
                        <FeatureIcon className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-slate-700">{feature.text}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                onClick={handleNext}
                className={cn(
                  "flex-1 gap-2 bg-gradient-to-r text-white shadow-lg hover:shadow-xl transition-all",
                  step.gradient
                )}
              >
                {isLastStep ? 'Complete Tour' : 'Next Step'}
                <ChevronRight className="h-4 w-4" />
              </Button>
              {step.action && (
                <Button variant="outline" onClick={handleAction} className="gap-2">
                  {step.action.label}
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function LearningCenter() {
  const getLevelColor = (level: LearningModule['level']) => {
    switch (level) {
      case 'beginner': return 'bg-violet-100 text-violet-700';
      case 'intermediate': return 'bg-amber-100 text-amber-700';
      case 'advanced': return 'bg-violet-100 text-violet-700';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-lg">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Learning Center</h2>
          <p className="text-sm text-slate-500">Master ConTigo with guided tutorials and courses</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {learningModules.map((module) => {
          const ModuleIcon = module.icon;
          return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{ type: "spring" }}
            >
              <Link href={module.locked ? '#' : module.href}>
                <Card className={cn(
                  "h-full transition-all hover:shadow-lg",
                  module.locked && "opacity-60 cursor-not-allowed"
                )}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50">
                        <ModuleIcon className="h-6 w-6 text-slate-700" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getLevelColor(module.level)}>
                          {module.level}
                        </Badge>
                        {module.locked && <Lock className="h-4 w-4 text-slate-400" />}
                        {module.completed && <CheckCircle2 className="h-4 w-4 text-violet-500" />}
                      </div>
                    </div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      <Clock className="h-3 w-3" />
                      <span>{module.duration}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {module.topics.map((topic, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                    {!module.locked && (
                      <Button variant="ghost" className="w-full mt-4 gap-2">
                        Start Learning
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function FeatureGuides() {
  const categories = Array.from(new Set(featureGuides.map(g => g.category)));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-500 text-white shadow-lg">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Feature Guides</h2>
          <p className="text-sm text-slate-500">Step-by-step guides for every feature</p>
        </div>
      </div>

      {categories.map((category) => (
        <div key={category} className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{category}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featureGuides
              .filter(g => g.category === category)
              .map((guide) => {
                const GuideIcon = guide.icon;
                return (
                  <motion.div
                    key={guide.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link href={guide.href}>
                      <Card className="h-full transition-all hover:shadow-md hover:border-slate-300">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-slate-100">
                              <GuideIcon className="h-5 w-5 text-slate-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-slate-900 truncate">{guide.title}</h4>
                                {guide.isNew && (
                                  <Badge className="bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[10px] px-1.5">
                                    NEW
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{guide.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== Main Component =====
export default function TourClient() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('tour');

  // Handle hash navigation
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash === 'learn') setActiveTab('learn');
    else if (hash === 'guides') setActiveTab('guides');
    
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-100 to-purple-100 rounded-full text-sm font-medium text-violet-700 mb-4">
            <Sparkles className="h-4 w-4" />
            Welcome to ConTigo
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 bg-clip-text text-transparent">
            Learn & Explore
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Discover everything ConTigo has to offer with interactive tours, comprehensive tutorials, and detailed feature guides.
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
        >
          {[
            { label: 'Tour Steps', value: tourSteps.length, icon: PlayCircle, color: 'from-violet-500 to-purple-500' },
            { label: 'Learning Modules', value: learningModules.length, icon: GraduationCap, color: 'from-violet-500 to-purple-500' },
            { label: 'Feature Guides', value: featureGuides.length, icon: BookOpen, color: 'from-violet-500 to-violet-500' },
            { label: 'Total Duration', value: '~2hrs', icon: Clock, color: 'from-amber-500 to-orange-500' },
          ].map((stat, i) => {
            const StatIcon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i + 0.2 }}
              >
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className={cn(
                      "inline-flex p-3 rounded-xl bg-gradient-to-br text-white mb-3",
                      stat.color
                    )}>
                      <StatIcon className="h-5 w-5" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                    <div className="text-sm text-slate-500">{stat.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="tour" className="gap-2">
              <PlayCircle className="h-4 w-4" />
              Tour
            </TabsTrigger>
            <TabsTrigger value="learn" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              Learn
            </TabsTrigger>
            <TabsTrigger value="guides" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Guides
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tour">
            <InteractiveTour />
          </TabsContent>

          <TabsContent value="learn">
            <LearningCenter />
          </TabsContent>

          <TabsContent value="guides">
            <FeatureGuides />
          </TabsContent>
        </Tabs>

        {/* Quick Start CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-16 text-center"
        >
          <Card className="bg-gradient-to-r from-violet-500 via-purple-500 to-purple-500 text-white border-0">
            <CardContent className="py-12">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-90" />
              <h3 className="text-2xl font-bold mb-2">Ready to Get Started?</h3>
              <p className="text-white/80 mb-6 max-w-md mx-auto">
                Jump right in and start managing your contracts with AI-powered intelligence.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link href="/upload">
                  <Button size="lg" className="bg-white text-violet-700 hover:bg-slate-100 gap-2">
                    <Upload className="h-5 w-5" />
                    Upload First Contract
                  </Button>
                </Link>
                <Link href="/ai/chat">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Try AI Chat
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
