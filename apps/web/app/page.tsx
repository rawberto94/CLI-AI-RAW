'use client';

import Link from 'next/link';
import { 
  FileText, 
  Shield, 
  Zap, 
  BarChart3, 
  Clock, 
  Globe, 
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Play,
  Users,
  Building2,
  TrendingUp,
  Search,
  Bell,
  Brain,
  Lock,
  Star
} from 'lucide-react';

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="group flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 transition-all group-hover:shadow-indigo-500/40">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                ConTigo
              </span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              {['Features', 'Pricing', 'About', 'Contact'].map((item) => (
                <Link 
                  key={item}
                  href={`/${item.toLowerCase()}`} 
                  className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
                >
                  {item}
                </Link>
              ))}
            </nav>
            
            <div className="flex items-center gap-3">
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signin"
                className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-105"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-indigo-500/20 to-transparent rounded-full blur-3xl" />
        </div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-30" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 mb-8 animate-fade-in">
              <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
              <span className="text-sm font-medium text-indigo-300">AI-Powered Contract Intelligence</span>
            </div>
            
            {/* Main Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight animate-fade-in-up">
              <span className="text-white">Transform Your</span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
                Contract Management
              </span>
            </h1>
            
            <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed animate-fade-in opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
              ConTigo uses advanced AI to extract insights, track obligations, and 
              automate your entire contract lifecycle. Save hours of manual work every week.
            </p>
            
            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
              <Link
                href="/auth/signin"
                className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-2xl shadow-indigo-500/30 transition-all hover:shadow-indigo-500/50 hover:scale-105 animate-pulse-glow"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <button className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20">
                <Play className="h-5 w-5 text-indigo-400" />
                Watch Demo
              </button>
            </div>
            
            {/* Trust Badges */}
            <div className="mt-12 flex flex-col items-center gap-4 animate-fade-in opacity-0" style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}>
              <p className="text-sm text-slate-500">Trusted by leading companies</p>
              <div className="flex items-center gap-8 opacity-50 grayscale hover:opacity-70 hover:grayscale-0 transition-all duration-500">
                {['Enterprise Co', 'Tech Corp', 'Global Inc', 'Innovate LLC'].map((company, i) => (
                  <div key={company} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors" style={{ animationDelay: `${0.8 + i * 0.1}s` }}>
                    <Building2 className="h-5 w-5" />
                    <span className="text-sm font-medium">{company}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Browser Mockup */}
          <div className="mt-20 relative animate-fade-in-up opacity-0" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="relative mx-auto max-w-5xl rounded-2xl border border-white/10 bg-slate-900/50 p-2 shadow-2xl shadow-black/50 backdrop-blur-sm hover-lift">
              {/* Browser Chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-4 py-1.5">
                    <Lock className="h-3 w-3 text-green-400" />
                    <span className="text-xs text-slate-400">app.contigo.io/dashboard</span>
                  </div>
                </div>
              </div>
              
              {/* Dashboard Preview */}
              <div className="p-6 bg-slate-950 rounded-b-xl">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Active Contracts', value: '2,847', trend: '+12%', color: 'indigo' },
                    { label: 'Pending Review', value: '156', trend: '-8%', color: 'purple' },
                    { label: 'Value Tracked', value: '$45.2M', trend: '+23%', color: 'pink' },
                    { label: 'Renewals Due', value: '34', trend: '7 days', color: 'amber' }
                  ].map((stat, i) => (
                    <div key={stat.label} className="rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 transition-colors group">
                      <p className="text-xs text-slate-400">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-white group-hover:scale-105 transition-transform origin-left">{stat.value}</p>
                      <p className={`mt-1 text-xs ${stat.color === 'amber' ? 'text-amber-400' : 'text-green-400'}`}>{stat.trend}</p>
                    </div>
                  ))}
                </div>
                <div className="h-32 rounded-xl border border-white/5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 animate-shimmer" />
                  <BarChart3 className="h-16 w-16 text-slate-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Everything You Need for
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Contract Success</span>
            </h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
              Powerful features designed to streamline your contract workflow from start to finish.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: 'AI-Powered Extraction',
                description: 'Automatically extract key terms, dates, obligations, and parties from any contract format.',
                gradient: 'from-indigo-500 to-indigo-600',
                shadow: 'shadow-indigo-500/25'
              },
              {
                icon: Search,
                title: 'Semantic Search',
                description: 'Find any clause or term instantly with natural language search across your entire contract library.',
                gradient: 'from-purple-500 to-purple-600',
                shadow: 'shadow-purple-500/25'
              },
              {
                icon: Bell,
                title: 'Smart Alerts',
                description: 'Never miss a deadline with intelligent notifications for renewals, expirations, and milestones.',
                gradient: 'from-pink-500 to-pink-600',
                shadow: 'shadow-pink-500/25'
              },
              {
                icon: BarChart3,
                title: 'Advanced Analytics',
                description: 'Gain insights into contract performance, risk exposure, and portfolio health at a glance.',
                gradient: 'from-cyan-500 to-cyan-600',
                shadow: 'shadow-cyan-500/25'
              },
              {
                icon: Shield,
                title: 'Enterprise Security',
                description: 'Bank-grade encryption, SOC 2 compliance, and GDPR-ready data protection for peace of mind.',
                gradient: 'from-emerald-500 to-emerald-600',
                shadow: 'shadow-emerald-500/25'
              },
              {
                icon: Globe,
                title: 'Seamless Integrations',
                description: 'Connect with Salesforce, DocuSign, SharePoint, and 50+ other tools your team already uses.',
                gradient: 'from-amber-500 to-amber-600',
                shadow: 'shadow-amber-500/25'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group relative rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-sm transition-all hover:border-white/10 hover:bg-white/10"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg ${feature.shadow} transition-transform group-hover:scale-110`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { icon: FileText, value: '10M+', label: 'Contracts Processed' },
              { icon: Clock, value: '85%', label: 'Time Saved' },
              { icon: Users, value: '500+', label: 'Enterprise Customers' },
              { icon: TrendingUp, value: '99.9%', label: 'Uptime SLA' }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 mb-4">
                  <stat.icon className="h-7 w-7 text-indigo-400" />
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="mt-1 text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-24 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Get Started in
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Minutes</span>
            </h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
              Three simple steps to transform your contract management workflow.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Contracts',
                description: 'Drag and drop your contracts or connect your existing storage. We support PDF, Word, and 20+ formats.'
              },
              {
                step: '02',
                title: 'AI Analysis',
                description: 'Our AI automatically extracts key terms, identifies risks, and categorizes your contracts in seconds.'
              },
              {
                step: '03',
                title: 'Manage & Monitor',
                description: 'Track obligations, set alerts, and get insights through your personalized dashboard.'
              }
            ].map((item, index) => (
              <div key={index} className="relative">
                {index < 2 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-indigo-500/50 to-transparent" />
                )}
                <div className="text-6xl font-bold text-indigo-500/20">{item.step}</div>
                <h3 className="mt-4 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="relative py-24 overflow-hidden">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 md:p-12 backdrop-blur-sm">
            <div className="absolute top-6 left-8 text-6xl text-indigo-500/20">&ldquo;</div>
            <div className="relative">
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <blockquote className="text-xl md:text-2xl text-white leading-relaxed">
                ConTigo has transformed how we manage our contract portfolio. What used to take 
                our legal team hours now happens automatically. The AI extraction is incredibly 
                accurate, and the insights have helped us identify cost savings we never knew existed.
              </blockquote>
              <div className="mt-8 flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  SJ
                </div>
                <div>
                  <div className="font-semibold text-white">Sarah Johnson</div>
                  <div className="text-slate-400">General Counsel, TechCorp Industries</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to Transform Your Contract Management?
          </h2>
          <p className="mt-4 text-lg text-indigo-100 max-w-2xl mx-auto">
            Join hundreds of companies already saving time and reducing risk with ConTigo.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signin"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-indigo-600 shadow-2xl transition-all hover:bg-slate-100 hover:scale-105"
            >
              Start Your Free Trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/50"
            >
              Schedule a Demo
            </Link>
          </div>
          <p className="mt-6 text-sm text-indigo-200">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">ConTigo</span>
              </Link>
              <p className="mt-4 text-sm text-slate-400 max-w-xs">
                AI-powered contract intelligence platform for modern businesses.
              </p>
            </div>
            
            {[
              {
                title: 'Product',
                links: ['Features', 'Pricing', 'Security', 'Integrations']
              },
              {
                title: 'Company',
                links: ['About', 'Contact', 'Careers', 'Blog']
              },
              {
                title: 'Legal',
                links: ['Privacy', 'Terms', 'Security', 'Compliance']
              }
            ].map((section) => (
              <div key={section.title}>
                <h4 className="font-semibold text-white">{section.title}</h4>
                <ul className="mt-4 space-y-2">
                  {section.links.map((link) => (
                    <li key={link}>
                      <Link 
                        href={`/${link.toLowerCase()}`}
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} ConTigo. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2 text-sm text-slate-500">
                <Shield className="h-4 w-4 text-green-500" />
                SOC 2 Certified
              </span>
              <span className="flex items-center gap-2 text-sm text-slate-500">
                <Globe className="h-4 w-4 text-blue-500" />
                GDPR Compliant
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
