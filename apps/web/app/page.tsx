'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  FileText, 
  Shield, 
  Zap, 
  Users, 
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  MessageSquare,
  Lock,
  BarChart3,
  Search,
  FileCheck,
  Sparkles,
  Play,
  ArrowUpRight,
  Layers,
  AlertTriangle,
  Check,
  X,
  Menu,
  Brain,
  Cpu,
  Database,
  FileSearch,
  Lightbulb,
  Rocket,
  Award,
  Timer,
  ShieldCheck,
  CircuitBoard,
  Boxes,
  Fingerprint,
  Upload,
  Scan,
  CheckCircle,
  Wand2
} from 'lucide-react';

// Animated Gradient Orb Component
function GradientOrb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div 
      className={`absolute rounded-full blur-3xl opacity-30 animate-pulse ${className}`}
      style={{ animationDelay: `${delay}ms`, animationDuration: '4s' }}
    />
  );
}

// Floating Particle Background
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-teal-500/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) translateX(10px) scale(1.5); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

// Animated Grid Background
function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(20, 184, 166, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20, 184, 166, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          animation: 'gridMove 20s linear infinite',
        }}
      />
      <style jsx>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
      `}</style>
    </div>
  );
}

// Glowing Border Card
function GlowCard({ children, className = '', glowColor = 'teal' }: { children: React.ReactNode; className?: string; glowColor?: string }) {
  const colors: Record<string, string> = {
    teal: 'from-teal-500 to-emerald-500',
    violet: 'from-violet-500 to-purple-500',
    blue: 'from-blue-500 to-cyan-500',
    orange: 'from-orange-500 to-amber-500',
  };
  return (
    <div className={`relative group ${className}`}>
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${colors[glowColor]} rounded-3xl opacity-0 group-hover:opacity-75 blur transition-all duration-500 group-hover:duration-200`} />
      <div className="relative bg-white rounded-3xl">{children}</div>
    </div>
  );
}

// 3D Tilt Card
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };
  
  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
  };
  
  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-transform duration-300 ease-out ${className}`}
    >
      {children}
    </div>
  );
}

// Shimmer Button
function ShimmerButton({ children, className = '', href }: { children: React.ReactNode; className?: string; href?: string }) {
  const content = (
    <span className={`relative inline-flex items-center gap-3 px-8 py-4 bg-gray-900 text-white font-semibold rounded-full overflow-hidden group ${className}`}>
      <span className="relative z-10 flex items-center gap-3">{children}</span>
      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </span>
  );
  return href ? <Link href={href}>{content}</Link> : <button>{content}</button>;
}

// Morphing Blob
function MorphingBlob({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute ${className}`}>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <linearGradient id="blobGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path fill="url(#blobGradient)">
          <animate
            attributeName="d"
            dur="10s"
            repeatCount="indefinite"
            values="
              M44.5,-76.3C57.9,-68.6,68.8,-56.2,76.6,-42.1C84.4,-28,89.1,-12.3,88.4,3.1C87.7,18.5,81.5,33.7,72.1,46.4C62.7,59.1,50,69.3,35.6,76.4C21.2,83.5,5.1,87.5,-10.7,86.3C-26.5,85.1,-42,78.7,-55.3,69.1C-68.6,59.5,-79.7,46.7,-85.3,31.8C-90.9,16.9,-91,-0.1,-86.1,-15.4C-81.2,-30.7,-71.3,-44.3,-58.8,-52.4C-46.3,-60.5,-31.2,-63.1,-17.1,-64.8C-3,-66.5,10.1,-67.3,23.4,-68.5C36.7,-69.7,50.2,-71.3,44.5,-76.3Z;
              M47.7,-79.8C60.3,-72.4,68.1,-56.5,74.6,-40.5C81.1,-24.5,86.3,-8.4,85.2,7.1C84.1,22.6,76.7,37.5,66.4,49.5C56.1,61.5,42.9,70.6,28.4,76.2C13.9,81.8,-1.9,83.9,-17.4,81.1C-32.9,78.3,-48.1,70.6,-60.2,59.3C-72.3,48,-81.3,33.1,-84.7,16.9C-88.1,0.7,-85.9,-16.8,-79.1,-31.8C-72.3,-46.8,-60.9,-59.3,-47.1,-66.3C-33.3,-73.3,-17.2,-74.8,0.4,-75.5C18,-76.2,35.1,-76.1,47.7,-79.8Z;
              M44.5,-76.3C57.9,-68.6,68.8,-56.2,76.6,-42.1C84.4,-28,89.1,-12.3,88.4,3.1C87.7,18.5,81.5,33.7,72.1,46.4C62.7,59.1,50,69.3,35.6,76.4C21.2,83.5,5.1,87.5,-10.7,86.3C-26.5,85.1,-42,78.7,-55.3,69.1C-68.6,59.5,-79.7,46.7,-85.3,31.8C-90.9,16.9,-91,-0.1,-86.1,-15.4C-81.2,-30.7,-71.3,-44.3,-58.8,-52.4C-46.3,-60.5,-31.2,-63.1,-17.1,-64.8C-3,-66.5,10.1,-67.3,23.4,-68.5C36.7,-69.7,50.2,-71.3,44.5,-76.3Z
            "
          />
        </path>
      </svg>
    </div>
  );
}

// Animated Counter Component
function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!hasStarted) return;
    
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [hasStarted, end, duration]);

  useEffect(() => {
    const timer = setTimeout(() => setHasStarted(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return <span>{count}{suffix}</span>;
}

// FAQ Item Component
function FAQItem({ question, answer, isOpen, onClick }: { question: string; answer: string; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onClick}
        className="w-full py-6 flex items-center justify-between text-left hover:text-teal-600 transition-colors group"
      >
        <span className="text-lg font-semibold text-gray-900 group-hover:text-teal-600 pr-8">{question}</span>
        <div className={`w-8 h-8 rounded-full bg-gray-100 group-hover:bg-teal-100 flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-teal-100 rotate-180' : ''}`}>
          <ChevronDown className={`w-5 h-5 text-gray-500 group-hover:text-teal-600 transition-all duration-300 ${isOpen ? 'text-teal-600' : ''}`} />
        </div>
      </button>
      <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] pb-6' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="text-gray-600 leading-relaxed text-lg">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

// Feature Card Component - Enhanced
function FeatureCard({ icon: Icon, title, description, features, gradient }: { 
  icon: React.ComponentType<{ className?: string }>; 
  title: string; 
  description: string;
  features: string[];
  gradient: string;
}) {
  return (
    <TiltCard>
      <div className="relative group h-full">
        {/* Hover Glow */}
        <div className={`absolute -inset-0.5 ${gradient} rounded-3xl opacity-0 group-hover:opacity-60 blur-xl transition-all duration-500`} />
        
        <div className="relative bg-white p-8 rounded-3xl border border-gray-100 hover:border-gray-200 h-full transition-all duration-300 group-hover:shadow-2xl">
          {/* Top Accent Line */}
          <div className={`absolute top-0 left-8 right-8 h-0.5 ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full`} />
          
          {/* Icon */}
          <div className="relative mb-6">
            <div className={`absolute inset-0 ${gradient} rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity`} />
            <div className={`relative w-16 h-16 ${gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
              <Icon className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-600 transition-all">{title}</h3>
          <p className="text-gray-600 leading-relaxed mb-6">{description}</p>
          
          <ul className="space-y-3">
            {features.map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-gray-500 group-hover:text-gray-600 transition-colors">
                <div className={`w-5 h-5 rounded-full ${gradient} flex items-center justify-center flex-shrink-0 opacity-80`}>
                  <Check className="w-3 h-3 text-white" />
                </div>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </TiltCard>
  );
}

// AI Pipeline Step Component
function AIPipelineStep({ step, title, description, icon: Icon, isLast = false }: {
  step: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-6">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30 z-10">
          <Icon className="w-7 h-7 text-white" />
        </div>
        {!isLast && (
          <div className="w-0.5 h-full bg-gradient-to-b from-teal-400 to-teal-200 mt-4" />
        )}
      </div>
      
      {/* Content */}
      <div className="pb-12">
        <div className="text-sm font-medium text-teal-600 mb-1">Step {step}</div>
        <h4 className="text-xl font-bold text-gray-900 mb-2">{title}</h4>
        <p className="text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// Innovation Card - Enhanced
function InnovationCard({ icon: Icon, title, description, stat, statLabel }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
}) {
  return (
    <TiltCard>
      <div className="relative group h-full">
        {/* Subtle Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-purple-600 rounded-3xl opacity-0 group-hover:opacity-50 blur-xl transition-all duration-500" />
        
        <div className="relative bg-white p-8 rounded-3xl border border-gray-100 hover:border-violet-200 h-full transition-all duration-300 group-hover:shadow-2xl overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
            <Icon className="w-full h-full" />
          </div>
          
          <div className="relative">
            <div className="flex items-start justify-between mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
                <div className="relative w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                  <Icon className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600 group-hover:from-violet-500 group-hover:to-purple-500 transition-all">{stat}</div>
                <div className="text-sm text-gray-400 group-hover:text-gray-500 transition-colors">{statLabel}</div>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-violet-700 transition-colors">{title}</h3>
            <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors">{description}</p>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}

// Mobile Menu Component
function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-2">
          <X className="w-6 h-6" />
        </button>
        <nav className="mt-12 space-y-4">
          <a href="#features" onClick={onClose} className="block py-3 text-gray-700 hover:text-teal-600 font-medium border-b border-gray-100">Features</a>
          <a href="#ai-technology" onClick={onClose} className="block py-3 text-gray-700 hover:text-teal-600 font-medium border-b border-gray-100">AI Technology</a>
          <a href="#architecture" onClick={onClose} className="block py-3 text-gray-700 hover:text-teal-600 font-medium border-b border-gray-100">Architecture</a>
          <a href="#innovation" onClick={onClose} className="block py-3 text-gray-700 hover:text-teal-600 font-medium border-b border-gray-100">Innovation</a>
          <a href="#security" onClick={onClose} className="block py-3 text-gray-700 hover:text-teal-600 font-medium border-b border-gray-100">Security</a>
          <a href="#faq" onClick={onClose} className="block py-3 text-gray-700 hover:text-teal-600 font-medium border-b border-gray-100">FAQ</a>
          <div className="pt-6 space-y-3">
            <Link href="/auth/signin" className="block w-full text-center py-3 text-gray-700 border border-gray-200 rounded-xl font-medium">
              Sign In
            </Link>
            <Link href="/auth/signin" className="block w-full text-center py-3 bg-teal-600 text-white rounded-xl font-medium">
              Get Started
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const faqs = [
    {
      question: "What types of contracts can ConTigo handle?",
      answer: "ConTigo supports all types of business contracts including NDAs, service agreements, employment contracts, vendor agreements, licensing agreements, SOWs, and more. We support PDF, Word, and 20+ document formats. Our AI is trained on millions of contracts across industries."
    },
    {
      question: "How does the AI analysis work?",
      answer: "Our AI uses a multi-stage pipeline: First, documents are parsed and normalized. Then, our NLP models extract entities, dates, and clauses. Next, our risk analysis engine identifies potential issues. Finally, everything is indexed for semantic search. The entire process takes seconds."
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely. We use bank-grade AES-256 encryption for all data at rest and in transit. Our platform is designed to meet SOC 2 Type II compliance requirements. We maintain comprehensive, tamper-proof audit logs. Your data never leaves our secure infrastructure."
    },
    {
      question: "Can I integrate ConTigo with other tools?",
      answer: "Yes! ConTigo offers a robust REST API and webhooks that allow you to integrate with your existing tools including Salesforce, HubSpot, DocuSign, SharePoint, Google Drive, and many more. We also support SSO with SAML 2.0."
    },
    {
      question: "What makes ConTigo different from other CLM solutions?",
      answer: "ConTigo combines cutting-edge AI with enterprise-grade infrastructure. Unlike legacy solutions, we're built cloud-native with real-time collaboration, instant semantic search, and AI that actually understands contracts—not just keyword matching."
    },
    {
      question: "How long does it take to get started?",
      answer: "You can be up and running in under 5 minutes. Simply sign up, upload your contracts, and our AI will start organizing and analyzing them immediately. For enterprise implementations, our team ensures smooth migration."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Innovative Floating Navigation */}
      <nav className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${scrolled ? 'top-2' : 'top-6'}`}>
        <div className={`flex items-center gap-1 px-2 py-2 rounded-full transition-all duration-500 ${
          scrolled 
            ? 'bg-white/90 backdrop-blur-xl shadow-lg shadow-gray-200/50 border border-gray-200/50' 
            : 'bg-white/70 backdrop-blur-md shadow-xl shadow-gray-900/5 border border-white/50'
        }`}>
          {/* Nav Pills */}
          <div className="hidden md:flex items-center">
            {[
              { label: 'Features', href: '#features' },
              { label: 'AI Tech', href: '#ai-technology' },
              { label: 'Architecture', href: '#architecture' },
              { label: 'Pricing', href: '/pricing', isLink: true },
              { label: 'FAQ', href: '#faq' },
            ].map((item, i) => (
              item.isLink ? (
                <Link 
                  key={i}
                  href={item.href}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
                >
                  {item.label}
                </Link>
              ) : (
                <a 
                  key={i}
                  href={item.href}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
                >
                  {item.label}
                </a>
              )
            ))}
          </div>
          
          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gray-200 mx-2" />
          
          {/* CTA Buttons */}
          <div className="flex items-center gap-2">
            <Link 
              href="/auth/signin" 
              className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/auth/signin" 
              className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-semibold rounded-full hover:shadow-lg hover:shadow-teal-500/30 transition-all duration-300 hover:scale-105"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(true)} 
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Hero Section - Next-Gen */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-teal-50/30" />
        <AnimatedGrid />
        <MorphingBlob className="top-20 right-0 w-[600px] h-[600px] opacity-50" />
        <GradientOrb className="top-40 left-20 w-[400px] h-[400px] bg-gradient-to-br from-teal-400 to-cyan-400" delay={0} />
        <GradientOrb className="bottom-20 right-40 w-[300px] h-[300px] bg-gradient-to-br from-violet-400 to-purple-400" delay={2000} />
        <ParticleField />
        
        <div className="max-w-7xl mx-auto relative w-full">
          <div className="max-w-5xl mx-auto text-center">
            {/* Animated Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-200/50 text-teal-700 px-5 py-2.5 rounded-full text-sm font-medium mb-8 backdrop-blur-sm animate-pulse">
              <div className="relative">
                <Sparkles className="w-4 h-4" />
                <span className="absolute inset-0 animate-ping"><Sparkles className="w-4 h-4 text-teal-400" /></span>
              </div>
              <span className="bg-gradient-to-r from-teal-700 to-emerald-600 bg-clip-text text-transparent font-semibold">AI-Powered Contract Intelligence</span>
              <span className="px-2 py-0.5 bg-teal-500 text-white text-xs rounded-full font-bold">NEW</span>
            </div>

            {/* Logo - Hero Size */}
            <div className="flex justify-center mb-2 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-400/30 via-emerald-400/30 to-cyan-400/30 blur-3xl scale-150" />
              <Image 
                src="/logo-transparent.png" 
                alt="ConTigo" 
                width={1600} 
                height={427} 
                className="h-80 md:h-[400px] lg:h-[500px] xl:h-[550px] w-auto relative z-10 drop-shadow-xl" 
                priority 
              />
            </div>
            
            {/* Main Headline with Gradient Animation */}
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-gray-900 mb-8 leading-[1.1] tracking-tight">
              AI That Reads Your<br />
              Contracts{' '}
              <span className="relative">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-500 to-cyan-500 bg-[length:200%_100%] animate-gradient">For You</span>
                <span className="absolute -bottom-2 left-0 right-0 h-3 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 blur-lg" />
              </span>
            </h1>
            <style jsx>{`
              @keyframes gradient {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
              }
              .animate-gradient {
                animation: gradient 3s ease infinite;
              }
            `}</style>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
              Upload any contract. Get instant analysis, risk alerts, and actionable insights.
              <span className="block mt-2 text-gray-500">No more manual reviews. No more missed deadlines.</span>
            </p>
            
            {/* CTA Buttons with Enhanced Effects */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <ShimmerButton href="/auth/signin">
                Get Started
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </ShimmerButton>
              <a href="#ai-technology" className="group relative text-gray-700 px-8 py-4 rounded-full font-semibold border-2 border-gray-200 hover:border-teal-400 transition-all flex items-center gap-3 bg-white/80 backdrop-blur-sm hover:shadow-lg hover:shadow-teal-500/10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center group-hover:from-teal-100 group-hover:to-emerald-100 transition-all">
                  <Play className="w-4 h-4 ml-0.5 text-gray-600 group-hover:text-teal-600 transition-colors" />
                </div>
                <span className="group-hover:text-teal-700 transition-colors">See It In Action</span>
              </a>
            </div>

            {/* Trust Badges with Hover Effects */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              {[
                { icon: <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />, text: '99.9% Uptime', color: 'text-green-600' },
                { icon: <Shield className="w-4 h-4" />, text: 'SOC 2 Ready', color: 'text-teal-600' },
                { icon: <Lock className="w-4 h-4" />, text: '256-bit Encryption', color: 'text-teal-600' },
                { icon: <CheckCircle2 className="w-4 h-4" />, text: 'GDPR Compliant', color: 'text-teal-600' },
              ].map((badge, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-gray-100 hover:border-teal-200 hover:bg-white transition-all cursor-default group">
                  <span className={`${badge.color} group-hover:scale-110 transition-transform`}>{badge.icon}</span>
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors font-medium">{badge.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-400 animate-bounce">
          <span className="text-xs font-medium">Scroll to explore</span>
          <ChevronDown className="w-5 h-5" />
        </div>
      </section>

      {/* How It Works - Next-Gen 3D Cards */}
      <section className="py-32 px-6 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, rgba(20, 184, 166, 0.15) 0%, transparent 50%),
                               radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)`,
            }}
          />
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 text-teal-400 px-5 py-2.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
              <Wand2 className="w-4 h-4" />
              How It Works
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white">From Upload to <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">Insights</span></h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">See how ConTigo transforms your contract management in seconds, not hours</p>
          </div>
          
          {/* 3D Step Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {[
              { step: '01', icon: FileText, title: 'Upload Your Contracts', desc: 'Drag & drop PDFs, Word docs, or scans. Our OCR handles any format—even handwritten notes.', stat: '20+ formats', gradient: 'from-blue-500 to-cyan-500' },
              { step: '02', icon: Brain, title: 'AI Analyzes Everything', desc: 'In under 3 seconds, our AI extracts parties, dates, values, obligations, and flags risks.', stat: '<3 seconds', gradient: 'from-teal-500 to-emerald-500' },
              { step: '03', icon: Sparkles, title: 'Get Actionable Insights', desc: 'Search in natural language, set renewal alerts, and let AI answer questions instantly.', stat: '99% accuracy', gradient: 'from-violet-500 to-purple-500' },
            ].map((item, i) => (
              <TiltCard key={i}>
                <div className="relative group h-full">
                  {/* Step Number Background */}
                  <div className="absolute -top-6 -left-4 text-[120px] font-black text-white/[0.03] group-hover:text-teal-500/10 transition-all duration-500 select-none">{item.step}</div>
                  
                  {/* Card */}
                  <div className="relative h-full">
                    {/* Glow Effect */}
                    <div className={`absolute -inset-0.5 bg-gradient-to-r ${item.gradient} rounded-3xl opacity-0 group-hover:opacity-50 blur-lg transition-all duration-500`} />
                    
                    <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/[0.06] transition-all duration-500 h-full group-hover:border-white/20">
                      {/* Icon with Glow */}
                      <div className="relative mb-6">
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} blur-xl opacity-50`} />
                        <div className={`relative w-16 h-16 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                          <item.icon className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold mb-3 text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-all">{item.title}</h3>
                      <p className="text-gray-400 mb-6 leading-relaxed group-hover:text-gray-300 transition-colors">{item.desc}</p>
                      
                      {/* Stat Badge */}
                      <div className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${item.gradient} bg-opacity-20 rounded-full text-sm font-semibold border border-white/10`}>
                        <Check className="w-4 h-4 text-white" />
                        <span className="text-white">{item.stat}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Connection Line */}
                  {i < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5">
                      <div className="w-full h-full bg-gradient-to-r from-white/20 to-transparent" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                    </div>
                  )}
                </div>
              </TiltCard>
            ))}
          </div>

          {/* Stats Row - Glassmorphism */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { value: <AnimatedCounter end={99} suffix="%" />, label: 'AI Accuracy', icon: Brain },
              { value: '<3s', label: 'Analysis Time', icon: Zap },
              { value: <AnimatedCounter end={18} suffix="+" />, label: 'Artifact Types', icon: Layers },
              { value: <AnimatedCounter end={50} suffix="+" />, label: 'Clause Types', icon: FileText },
            ].map((stat, i) => (
              <div key={i} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500" />
                <div className="relative text-center p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-teal-500/30 transition-all duration-300 group-hover:bg-white/[0.06]">
                  <stat.icon className="w-5 h-5 text-teal-500 mx-auto mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <div className="text-4xl md:text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">
                    {stat.value}
                  </div>
                  <div className="text-gray-500 text-sm font-medium group-hover:text-gray-300 transition-colors">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Enhanced */}
      <section id="features" className="py-32 px-6 bg-gradient-to-b from-white via-gray-50/50 to-white relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-teal-100/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-violet-100/30 to-transparent rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/50 text-teal-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
              <Layers className="w-4 h-4" />
              What AI Extracts
              <span className="px-2 py-0.5 bg-teal-500 text-white text-xs rounded-full">AUTO</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
              18+ Artifact Types,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">Automatically</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto font-light leading-relaxed">
              Every contract is analyzed and enriched with structured data you can search, filter, and act on.
            </p>
          </div>
          
          {/* AI Extraction Showcase - Interactive */}
          <GlowCard className="mb-16" glowColor="teal">
            <div className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">What our AI extracts from <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">every contract</span>:</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      'Parties & Contacts',
                      'Contract Value',
                      'Start & End Dates',
                      'Payment Terms',
                      'Obligations',
                      'Renewal Terms',
                      'Termination Clauses',
                      'Liability Limits',
                      'SLA Terms',
                      'Compliance Issues',
                      'Risk Factors',
                      'Negotiation Points',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm group cursor-default">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 group-hover:shadow-teal-500/30 transition-all">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-gray-700 group-hover:text-teal-700 transition-colors font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Code Preview with Typing Effect Style */}
                <div className="relative group">
                  <div className="absolute -inset-2 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 rounded-3xl opacity-20 blur-lg group-hover:opacity-40 transition-opacity" />
                  <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                    {/* Window Header */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <span className="text-xs text-gray-500 ml-2 font-mono">analysis_output.json</span>
                    </div>
                    <div className="p-6">
                      <div className="text-sm font-mono leading-loose">
                        <div className="text-gray-500">{'{'}</div>
                        <div className="pl-4"><span className="text-purple-400">&quot;parties&quot;</span><span className="text-gray-500">:</span> <span className="text-emerald-400">[&quot;Acme Corp&quot;, &quot;TechStart Inc&quot;]</span><span className="text-gray-500">,</span></div>
                        <div className="pl-4"><span className="text-purple-400">&quot;contractValue&quot;</span><span className="text-gray-500">:</span> <span className="text-amber-400">&quot;$250,000&quot;</span><span className="text-gray-500">,</span></div>
                        <div className="pl-4"><span className="text-purple-400">&quot;startDate&quot;</span><span className="text-gray-500">:</span> <span className="text-cyan-400">&quot;2024-01-15&quot;</span><span className="text-gray-500">,</span></div>
                        <div className="pl-4"><span className="text-purple-400">&quot;endDate&quot;</span><span className="text-gray-500">:</span> <span className="text-cyan-400">&quot;2025-01-14&quot;</span><span className="text-gray-500">,</span></div>
                        <div className="pl-4"><span className="text-purple-400">&quot;autoRenewal&quot;</span><span className="text-gray-500">:</span> <span className="text-teal-400">true</span><span className="text-gray-500">,</span></div>
                        <div className="pl-4"><span className="text-purple-400">&quot;riskScore&quot;</span><span className="text-gray-500">:</span> <span className="text-orange-400">72</span><span className="text-gray-500">,</span></div>
                        <div className="pl-4"><span className="text-purple-400">&quot;obligations&quot;</span><span className="text-gray-500">:</span> <span className="text-teal-400">12</span><span className="text-gray-500">,</span></div>
                        <div className="pl-4"><span className="text-purple-400">&quot;missingClauses&quot;</span><span className="text-gray-500">:</span> <span className="text-rose-400">[&quot;liability_cap&quot;]</span></div>
                        <div className="text-gray-500">{'}'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </GlowCard>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={FileText} title="AI-Powered Analysis" description="Extract key terms, identify risks, and get intelligent insights automatically." features={['Auto-extract dates & terms', 'Risk identification', 'Smart suggestions']} gradient="bg-gradient-to-br from-violet-500 to-purple-600" />
            <FeatureCard icon={Shield} title="Enterprise Security" description="Bank-grade encryption and comprehensive audit logging for peace of mind." features={['End-to-end encryption', 'Role-based access', 'Complete audit trails']} gradient="bg-gradient-to-br from-teal-500 to-emerald-600" />
            <FeatureCard icon={Zap} title="Workflow Automation" description="Automate approvals, notifications, and renewals to eliminate delays." features={['Automated approvals', 'Smart notifications', 'Renewal reminders']} gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
            <FeatureCard icon={Users} title="Team Collaboration" description="Real-time editing, comments, and version control for your team." features={['Real-time co-editing', 'In-line comments', 'Version history']} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
            <FeatureCard icon={Search} title="Semantic Search" description="Find any contract, clause, or term instantly with AI-powered search." features={['Natural language queries', 'Cross-contract search', 'Similar clause finder']} gradient="bg-gradient-to-br from-rose-500 to-pink-600" />
            <FeatureCard icon={BarChart3} title="Analytics & Reports" description="Get actionable insights with dashboards and custom reports." features={['Contract analytics', 'Custom dashboards', 'Export options']} gradient="bg-gradient-to-br from-cyan-500 to-teal-600" />
          </div>
        </div>
      </section>

      {/* AI Technology Section - Enhanced */}
      <section id="ai-technology" className="py-32 px-6 bg-gradient-to-b from-white via-violet-50/30 to-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-violet-200/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-teal-200/30 to-transparent rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 text-violet-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
              <Brain className="w-4 h-4" />
              AI Technology
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
              The AI Engine Behind{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">ConTigo</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
              Our multi-stage AI pipeline doesn&apos;t just search—it understands. Trained on millions of contracts,
              it extracts 18+ artifact types with enterprise-grade accuracy.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left: Pipeline Steps */}
            <div>
              <AIPipelineStep 
                step={1}
                title="Document Ingestion & OCR"
                description="Contracts are uploaded and processed through our advanced OCR engine. Whether it's a scanned PDF, Word document, or image, we extract every character with 99.9% accuracy."
                icon={FileSearch}
              />
              <AIPipelineStep 
                step={2}
                title="NLP & Entity Extraction"
                description="Our Natural Language Processing models identify and extract key entities: parties, dates, monetary values, obligations, and over 50 different clause types."
                icon={Brain}
              />
              <AIPipelineStep 
                step={3}
                title="Semantic Understanding"
                description="Using transformer-based models trained on millions of legal documents, we understand the context and meaning—not just keywords. This enables true semantic search."
                icon={Lightbulb}
              />
              <AIPipelineStep 
                step={4}
                title="Risk Analysis Engine"
                description="Our AI compares clauses against best practices and flags potential risks: missing terms, unusual provisions, or compliance issues that need attention."
                icon={AlertTriangle}
              />
              <AIPipelineStep 
                step={5}
                title="Vector Indexing"
                description="Every contract is converted into high-dimensional vectors and indexed for instant semantic search. Find similar clauses across your entire repository in milliseconds."
                icon={Database}
                isLast
              />
            </div>

            {/* Right: AI Capabilities Visual - Enhanced */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-purple-500 to-teal-500 rounded-[2rem] opacity-30 blur-xl group-hover:opacity-50 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-3xl p-8 text-white sticky top-24 overflow-hidden">
                {/* Animated Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                </div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-lg opacity-50" />
                      <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Cpu className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">ConTigo AI Engine</h3>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-gray-400 text-sm">Real-time contract intelligence</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    {[
                      { label: 'Entity Extraction', value: 99.2, color: 'from-teal-500 to-emerald-400' },
                      { label: 'Clause Classification', value: 98.7, color: 'from-violet-500 to-purple-400' },
                      { label: 'Risk Detection', value: 97.5, color: 'from-amber-500 to-orange-400' },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-300">{item.label}</span>
                          <span className="text-sm font-bold text-teal-400">{item.value}%</span>
                        </div>
                        <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`} 
                            style={{ width: `${item.value}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: '50+', label: 'Clause Types', icon: FileText },
                      { value: '20+', label: 'Languages', icon: MessageSquare },
                      { value: '<3s', label: 'Avg. Analysis', icon: Zap },
                      { value: '10M+', label: 'Docs Trained', icon: Database },
                    ].map((stat, i) => (
                      <div key={i} className="bg-white/5 backdrop-blur rounded-xl p-4 text-center border border-white/10 hover:bg-white/10 hover:border-teal-500/30 transition-all group/stat">
                        <stat.icon className="w-4 h-4 text-teal-500 mx-auto mb-2 opacity-50 group-hover/stat:opacity-100 transition-opacity" />
                        <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 mb-1">{stat.value}</div>
                        <div className="text-xs text-gray-500">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Architecture & Technology Section */}
      <section id="architecture" className="py-24 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <CircuitBoard className="w-4 h-4" />
              How It Works
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
              Intelligent Contract Processing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto font-light">
              Our proprietary AI pipeline analyzes contracts in seconds, extracting insights that would take hours manually.
            </p>
          </div>

          {/* Simplified Visual Pipeline */}
          <div className="bg-white rounded-3xl border border-gray-200 p-8 mb-12">
            <div className="grid md:grid-cols-5 gap-6">
              {[
                { step: 1, title: 'Upload', desc: 'Drop any document format', icon: Upload, color: 'bg-blue-500' },
                { step: 2, title: 'Extract', desc: 'Advanced OCR & parsing', icon: Scan, color: 'bg-violet-500' },
                { step: 3, title: 'Analyze', desc: 'AI-powered insights', icon: Brain, color: 'bg-teal-500' },
                { step: 4, title: 'Validate', desc: 'Quality assurance', icon: ShieldCheck, color: 'bg-orange-500' },
                { step: 5, title: 'Ready', desc: 'Actionable results', icon: CheckCircle, color: 'bg-green-500' },
              ].map((item, i) => (
                <div key={i} className="text-center relative">
                  <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-sm font-bold text-gray-900 mb-1">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                  {i < 4 && (
                    <div className="hidden md:block absolute top-7 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-gray-300 to-gray-200" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Key Capabilities - Simplified */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                icon: Brain, 
                title: 'AI-Powered Analysis', 
                desc: 'Advanced machine learning extracts key terms, parties, dates, and obligations automatically.',
                features: ['Contract summarization', 'Risk identification', 'Clause analysis']
              },
              { 
                icon: Search, 
                title: 'Semantic Search', 
                desc: 'Ask questions in plain English and get instant answers from your entire contract library.',
                features: ['Natural language queries', 'Cross-contract search', 'Source citations']
              },
              { 
                icon: Shield, 
                title: 'Enterprise Security', 
                desc: 'Bank-grade encryption and compliance-ready infrastructure protect your sensitive data.',
                features: ['256-bit encryption', 'SOC 2 compliant', 'Audit logging']
              },
            ].map((item, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-gray-200 hover:shadow-xl transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 mb-6">{item.desc}</p>
                <ul className="space-y-2">
                  {item.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                      <Check className="w-4 h-4 text-teal-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Chatbot Demo Section - Enhanced */}
      <section className="py-32 px-6 bg-gradient-to-b from-white via-teal-50/20 to-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-teal-200/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-emerald-200/30 to-transparent rounded-full blur-3xl" />
        
        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/50 text-teal-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
                <MessageSquare className="w-4 h-4" />
                AI Chatbot
                <span className="px-2 py-0.5 bg-teal-500 text-white text-xs rounded-full">SMART</span>
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
                Ask Anything About{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">Your Contracts</span>
              </h2>
              <p className="text-xl text-gray-600 mb-8 font-light leading-relaxed">
                Our AI chatbot understands natural language. Ask questions, get instant answers with source citations, and take action—all through conversation.
              </p>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Try asking things like:</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    '"Show contracts expiring this month"',
                    '"What are our obligations to Acme Corp?"',
                    '"Find all NDAs with auto-renewal"',
                    '"Summarize the risk factors"',
                  ].map((q, i) => (
                    <span key={i} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full text-sm hover:border-teal-300 hover:bg-teal-50 transition-all cursor-pointer shadow-sm">
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Chat Demo - Enhanced */}
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 rounded-[2rem] opacity-30 blur-xl group-hover:opacity-50 transition-opacity duration-500" />
              <div className="relative bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-600 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 border-2 border-teal-600 rounded-full" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-lg">ConTigo AI</div>
                        <div className="text-teal-100 text-sm flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Online • Instant responses
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full bg-white/20" />
                      <div className="w-3 h-3 rounded-full bg-white/20" />
                      <div className="w-3 h-3 rounded-full bg-white/20" />
                    </div>
                  </div>
                </div>
                
                {/* Chat Messages */}
                <div className="p-6 space-y-4 bg-gradient-to-b from-gray-50 to-white min-h-[320px]">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-5 py-3 rounded-2xl rounded-br-md max-w-[80%] shadow-lg">
                      Show me all contracts expiring in the next 30 days
                    </div>
                  </div>
                  
                  {/* AI response */}
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 px-5 py-4 rounded-2xl rounded-bl-md max-w-[85%] shadow-lg">
                      <p className="text-gray-800 mb-4">I found <span className="font-bold text-teal-600">3 contracts</span> expiring in the next 30 days:</p>
                      <div className="space-y-2 text-sm">
                        {[
                          { name: 'Acme Corp - MSA', date: 'Jan 28', urgent: false },
                          { name: 'TechStart - SLA', date: 'Feb 5', urgent: false },
                          { name: 'GlobalCo - NDA', date: 'Feb 12', urgent: true },
                        ].map((contract, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer group/item">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-700 group-hover/item:text-teal-700 transition-colors">{contract.name}</span>
                            </div>
                            <span className={`font-semibold ${contract.urgent ? 'text-red-600' : 'text-orange-600'}`}>{contract.date}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-gray-500 text-sm mt-4 flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-teal-500" />
                        Would you like me to start the renewal process?
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Chat Input */}
                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      placeholder="Ask about your contracts..." 
                      className="flex-1 px-5 py-3.5 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-teal-500 outline-none text-gray-700 placeholder-gray-400"
                      disabled
                    />
                    <button className="w-12 h-12 bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40 transition-all hover:scale-105">
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why We're Innovative Section - Enhanced */}
      <section id="innovation" className="py-32 px-6 bg-gradient-to-b from-white via-violet-50/30 to-white relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-[700px] h-[700px] bg-gradient-to-tr from-violet-200/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-200/30 to-transparent rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 text-violet-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
              <Rocket className="w-4 h-4" />
              Why Choose ConTigo
              <span className="px-2 py-0.5 bg-violet-500 text-white text-xs rounded-full">BEST</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
              Not Just Another{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">CLM</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto font-light leading-relaxed">
              We built ConTigo from the ground up with AI at its core—not bolted on as an afterthought.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <InnovationCard 
              icon={Brain}
              title="True AI Understanding"
              description="Unlike keyword-based systems, our AI actually understands contract language. It can identify risks, suggest improvements, and find similar clauses even when worded differently."
              stat="10M+"
              statLabel="contracts trained"
            />
            <InnovationCard 
              icon={Timer}
              title="Real-Time Processing"
              description="Most CLM solutions take minutes or hours to analyze documents. ConTigo processes contracts in under 3 seconds, enabling instant insights and real-time collaboration."
              stat="<3s"
              statLabel="analysis time"
            />
            <InnovationCard 
              icon={Search}
              title="Semantic Search"
              description="Ask questions in natural language: 'Find all contracts with auto-renewal clauses expiring this quarter.' Our AI understands intent, not just keywords."
              stat="50+"
              statLabel="clause types"
            />
            <InnovationCard 
              icon={Fingerprint}
              title="Enterprise-Grade Security"
              description="Built from the ground up with security in mind. Multi-tenant isolation, encryption at rest and in transit, comprehensive audit logs, and compliance-ready architecture."
              stat="256-bit"
              statLabel="encryption"
            />
            <InnovationCard 
              icon={Boxes}
              title="API-First Design"
              description="Every feature available via our REST API. Integrate ConTigo into your existing workflows, CRM, or build custom applications on top of our platform."
              stat="100%"
              statLabel="API coverage"
            />
            <InnovationCard 
              icon={Award}
              title="Continuous Learning"
              description="Our AI models improve continuously based on user feedback and new contract patterns. The system gets smarter with every document it processes."
              stat="Daily"
              statLabel="model updates"
            />
          </div>

          {/* Comparison - Enhanced */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-purple-500 to-teal-500 rounded-[2rem] opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-500" />
            <div className="relative bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100/50 overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #6b7280 1px, transparent 0)', backgroundSize: '24px 24px' }} />
              
              <div className="relative">
                <div className="text-center mb-12">
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 text-violet-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                    <BarChart3 className="w-4 h-4" />
                    Direct Comparison
                  </div>
                  <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                    ConTigo vs. <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-gray-500">Legacy CLM</span>
                  </h3>
                  <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">See how next-generation AI contract intelligence compares to traditional contract management</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                  {/* Traditional CLM - Left Side */}
                  <div className="relative group/card">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-100/50 to-orange-100/50 rounded-2xl transition-all duration-300 group-hover/card:from-red-100/70 group-hover/card:to-orange-100/70" />
                    <div className="relative p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="relative">
                          <div className="absolute inset-0 bg-red-400 rounded-xl blur-lg opacity-30" />
                          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center">
                            <X className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-gray-900">Traditional CLM</h4>
                          <span className="text-xs text-gray-500 font-medium">Outdated Approach</span>
                        </div>
                      </div>
                      <ul className="space-y-4">
                        {[
                          { text: 'Keyword-based search only', detail: 'Miss important context' },
                          { text: 'Manual metadata tagging', detail: 'Hours of tedious work' },
                          { text: 'Minutes to process documents', detail: 'Slow turnaround times' },
                          { text: 'Complex, dated interfaces', detail: 'Steep learning curve' },
                          { text: 'On-premise deployment required', detail: 'High infrastructure costs' },
                          { text: 'Limited or no API access', detail: 'No integration flexibility' },
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-3 group/item">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-200 to-orange-200 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:from-red-300 group-hover/item:to-orange-300 transition-colors">
                              <X className="w-3.5 h-3.5 text-red-600" />
                            </div>
                            <div>
                              <span className="text-gray-900 font-medium">{item.text}</span>
                              <span className="text-gray-500 text-sm block">{item.detail}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {/* ConTigo - Right Side */}
                  <div className="relative group/card">
                    <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl opacity-30 blur-sm group-hover/card:opacity-50 transition-opacity" />
                    <div className="relative p-8 border-2 border-teal-300/50 rounded-2xl bg-gradient-to-br from-white to-teal-50/50 backdrop-blur-sm shadow-lg">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="relative">
                          <div className="absolute inset-0 bg-teal-500 rounded-xl blur-lg opacity-40" />
                          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                            <Check className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-gray-900">ConTigo</h4>
                          <span className="text-xs text-teal-600 font-semibold uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> AI-Powered
                          </span>
                        </div>
                      </div>
                      <ul className="space-y-4">
                        {[
                          { text: 'AI-powered semantic search', detail: 'Find contracts by meaning, not just keywords' },
                          { text: 'Automatic entity extraction', detail: 'Parties, dates, values extracted instantly' },
                          { text: 'Analysis in under 3 seconds', detail: '100x faster than manual review' },
                          { text: 'Modern, intuitive interface', detail: 'Get started in minutes, not days' },
                          { text: 'Cloud-native, deploy anywhere', detail: 'Swiss data centers, global access' },
                          { text: 'Full API access included', detail: 'Integrate with any system seamlessly' },
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-3 group/item">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md group-hover/item:scale-110 transition-transform">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                              <span className="text-gray-900 font-medium">{item.text}</span>
                              <span className="text-teal-600 text-sm block font-medium">{item.detail}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom CTA */}
          <div className="mt-12 text-center">
            <Link 
              href="/auth/signin" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-8 py-4 rounded-full font-semibold hover:shadow-xl hover:shadow-teal-500/25 transition-all group"
            >
              Get Started Today
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="text-gray-500 text-sm mt-4">Swiss data residency • Enterprise-grade security</p>
          </div>
        </div>
      </section>

      {/* Security Section - Enhanced */}
      <section id="security" className="py-32 px-6 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 text-teal-400 px-5 py-2.5 rounded-full text-sm font-semibold mb-8 backdrop-blur-sm">
                <ShieldCheck className="w-4 h-4" />
                Enterprise Security
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 tracking-tight leading-tight text-white">
                Your Data is{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">Protected</span>
              </h2>
              <p className="text-xl text-gray-300 mb-12 leading-relaxed font-light">
                Security isn&apos;t an afterthought—it&apos;s built into every layer of ConTigo.
              </p>
              
              <div className="space-y-4">
                {[
                  { icon: Lock, title: 'AES-256 Encryption', desc: 'Military-grade encryption for all data at rest and in transit', color: 'from-teal-500 to-emerald-500' },
                  { icon: Shield, title: 'SOC 2 Type II', desc: 'Rigorous security compliance and regular audits', color: 'from-blue-500 to-cyan-500' },
                  { icon: Users, title: 'Multi-Factor Auth', desc: 'MFA, SSO, and advanced access controls', color: 'from-violet-500 to-purple-500' },
                  { icon: FileCheck, title: 'Immutable Audit Logs', desc: 'Complete, tamper-proof activity tracking', color: 'from-amber-500 to-orange-500' },
                ].map((item, i) => (
                  <div key={i} className="group flex items-start gap-4 p-5 rounded-2xl bg-white/[0.03] backdrop-blur border border-white/10 hover:bg-white/[0.06] hover:border-teal-500/30 transition-all duration-300">
                    <div className="relative">
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity`} />
                      <div className={`relative w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <item.icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-1 text-white group-hover:text-teal-300 transition-colors">{item.title}</h4>
                      <p className="text-gray-400 group-hover:text-gray-300 transition-colors">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Security Dashboard Visual */}
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 rounded-[2rem] opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500 rounded-xl blur-lg opacity-50" />
                      <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">Security Status</div>
                      <div className="text-sm text-gray-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        All systems operational
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">100%</div>
                    <div className="text-xs text-gray-500">Protected</div>
                  </div>
                </div>
                
                {/* Status Items */}
                <div className="space-y-3">
                  {[
                    { label: 'Data Encryption', status: 'Active', color: 'green' },
                    { label: 'Access Control', status: 'Enforced', color: 'green' },
                    { label: 'Audit Logging', status: 'Enabled', color: 'green' },
                    { label: 'MFA Protection', status: 'Required', color: 'green' },
                    { label: 'Threat Detection', status: 'Monitoring', color: 'blue' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/5 hover:bg-white/[0.06] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color === 'green' ? 'bg-green-500' : 'bg-blue-500'} animate-pulse`} />
                        <span className="text-gray-300">{item.label}</span>
                      </div>
                      <span className={`text-sm font-semibold ${item.color === 'green' ? 'text-green-400' : 'text-blue-400'}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
                
                {/* Bottom Stats */}
                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold text-teal-400">99.99%</div>
                    <div className="text-xs text-gray-500">Uptime</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-teal-400">0</div>
                    <div className="text-xs text-gray-500">Breaches</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-teal-400">24/7</div>
                    <div className="text-xs text-gray-500">Monitoring</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section - Enhanced */}
      <section id="faq" className="py-32 px-6 bg-gradient-to-b from-white via-amber-50/30 to-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-amber-200/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-orange-200/20 to-transparent rounded-full blur-3xl" />
        
        <div className="max-w-4xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 text-amber-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
              <HelpCircle className="w-4 h-4" />
              Got Questions?
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
              Frequently Asked{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">Questions</span>
            </h2>
            <p className="text-xl text-gray-600 font-light leading-relaxed">
              Everything you need to know about ConTigo.
            </p>
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 rounded-[2rem] opacity-20 blur-lg group-hover:opacity-30 transition-opacity duration-500" />
            <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl border border-amber-100/50 shadow-xl overflow-hidden">
              <div className="px-6 md:px-10">
                {faqs.map((faq, index) => (
                  <FAQItem 
                    key={index}
                    question={faq.question}
                    answer={faq.answer}
                    isOpen={openFaq === index}
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support Section - Enhanced */}
      <section id="support" className="py-32 px-6 bg-gradient-to-b from-gray-50 via-rose-50/30 to-gray-50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-rose-200/30 via-purple-200/20 to-blue-200/30 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200/50 text-rose-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
              <MessageSquare className="w-4 h-4" />
              We&apos;re Here to Help
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
              Support &{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-pink-600">Resources</span>
            </h2>
            <p className="text-xl text-gray-600 font-light leading-relaxed">
              Everything you need to succeed with ConTigo.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, title: 'Documentation', desc: 'Comprehensive guides and API docs', link: 'View Docs', gradient: 'from-violet-500 to-purple-600' },
              { icon: HelpCircle, title: 'Help Center', desc: 'Tutorials and best practices', link: 'Visit Help Center', gradient: 'from-blue-500 to-indigo-600' },
              { icon: MessageSquare, title: 'Contact Support', desc: 'Get help from our team', link: 'Contact Us', gradient: 'from-teal-500 to-emerald-600' },
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className={`absolute -inset-1 bg-gradient-to-br ${item.gradient} rounded-[2rem] opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-500`} />
                <div className="relative bg-white/80 backdrop-blur-xl p-10 rounded-3xl border border-gray-100/50 hover:border-gray-200 hover:shadow-2xl transition-all duration-500 text-center h-full">
                  <div className="relative inline-block mb-8">
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity`} />
                    <div className={`relative w-20 h-20 bg-gradient-to-br ${item.gradient} rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg`}>
                      <item.icon className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-gray-800 transition-colors">{item.title}</h3>
                  <p className="text-gray-600 mb-8 text-lg leading-relaxed">{item.desc}</p>
                  <a href="#" className="inline-flex items-center text-teal-600 font-semibold hover:text-teal-700 text-lg group/link">
                    {item.link}
                    <ArrowUpRight className="w-5 h-5 ml-2 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Enhanced */}
      <section className="py-32 px-6 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-teal-500/20 via-emerald-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-to-tl from-violet-500/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 text-teal-400 px-5 py-2.5 rounded-full text-sm font-semibold mb-8 backdrop-blur-sm">
            <Rocket className="w-4 h-4" />
            Get Started Today
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-8 tracking-tight leading-tight">
            Ready to Transform Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">Contract Management</span>?
          </h2>
          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Join forward-thinking teams using ConTigo to streamline their workflows.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signin" className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full opacity-60 blur-lg group-hover:opacity-80 transition-opacity" />
              <div className="relative bg-white text-gray-900 px-10 py-5 rounded-full font-semibold hover:bg-gray-100 transition-all flex items-center gap-3 text-lg">
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
            <a href="mailto:sales@contigo.com" className="text-white px-10 py-5 rounded-full font-semibold border-2 border-white/20 hover:border-teal-500/50 hover:bg-teal-500/10 transition-all backdrop-blur-sm">
              Contact Sales
            </a>
          </div>
          
          {/* Trust indicators */}
          <div className="mt-16 pt-10 border-t border-white/10">
            <p className="text-gray-500 text-sm mb-6">Trusted by teams worldwide</p>
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-50">
              {['Fortune 500', 'Enterprise', 'Startups', 'Law Firms', 'Consulting'].map((item, i) => (
                <span key={i} className="text-gray-400 font-medium">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Enhanced */}
      <footer className="bg-gray-950 text-gray-400 py-20 px-6 relative overflow-hidden">
        {/* Subtle Background */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
            <div className="lg:col-span-2">
              <Image src="/logo-transparent.png" alt="ConTigo" width={180} height={48} className="h-12 w-auto mb-6 brightness-0 invert" />
              <p className="text-gray-500 leading-relaxed mb-6 max-w-sm">
                Enterprise contract management platform built for modern teams. Secure, intelligent, and scalable.
              </p>
              <div className="flex items-center gap-3">
                {[
                  { name: 'twitter', icon: '𝕏' },
                  { name: 'linkedin', icon: 'in' },
                  { name: 'github', icon: '◉' },
                ].map((social) => (
                  <a key={social.name} href="#" className="w-10 h-10 bg-gray-800/50 border border-gray-700/50 rounded-xl flex items-center justify-center hover:bg-teal-600 hover:border-teal-500 transition-all duration-300 group">
                    <span className="sr-only">{social.name}</span>
                    <span className="text-gray-400 group-hover:text-white transition-colors font-bold text-sm">{social.icon}</span>
                  </a>
                ))}
              </div>
            </div>
            
            {[
              { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'AI Technology', href: '#ai-technology' }, { label: 'Security', href: '#security' }, { label: 'Pricing', href: '/pricing' }, { label: 'API', href: '#' }] },
              { title: 'Resources', links: [{ label: 'Documentation', href: '#' }, { label: 'Help Center', href: '#support' }, { label: 'Blog', href: '#' }, { label: 'Changelog', href: '#' }, { label: 'Status', href: '#' }] },
              { title: 'Company', links: [{ label: 'About', href: '#' }, { label: 'Careers', href: '#' }, { label: 'Contact', href: '#support' }, { label: 'Partners', href: '#' }, { label: 'Legal', href: '#' }] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white font-semibold mb-6 text-lg">{col.title}</h4>
                <ul className="space-y-4">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="hover:text-teal-400 transition-colors duration-200">{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-gray-800/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} ConTigo. All rights reserved.</p>
            <div className="flex items-center gap-8 text-sm">
              {['Privacy', 'Terms', 'Cookies', 'GDPR'].map((item) => (
                <a key={item} href="#" className="hover:text-teal-400 transition-colors duration-200">{item}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
