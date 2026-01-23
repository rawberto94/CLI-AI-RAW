'use client';

import { 
  FileText, 
  ArrowRight,
  Sparkles,
  Target,
  Heart,
  Lightbulb,
  Users,
  Globe,
  Award,
  Zap
} from 'lucide-react';
import Link from 'next/link';

const values = [
  {
    icon: Target,
    title: 'Customer First',
    description: 'Every feature we build starts with a customer need. Your success is our success.',
    gradient: 'from-indigo-500 to-indigo-600',
  },
  {
    icon: Lightbulb,
    title: 'Innovation',
    description: 'We push the boundaries of what AI can do for contract management.',
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    icon: Heart,
    title: 'Trust & Security',
    description: 'We treat your data with the same care we would our own. Security is non-negotiable.',
    gradient: 'from-pink-500 to-pink-600',
  },
  {
    icon: Users,
    title: 'Collaboration',
    description: 'Great products come from diverse teams working together towards a common goal.',
    gradient: 'from-cyan-500 to-cyan-600',
  },
];

const milestones = [
  { year: '2021', title: 'Founded', description: 'ConTigo was born from a simple idea: contracts shouldn\'t be hard.' },
  { year: '2022', title: 'Seed Round', description: 'Raised $5M to build the next generation of contract intelligence.' },
  { year: '2023', title: 'AI Launch', description: 'Launched our proprietary AI engine with 95%+ extraction accuracy.' },
  { year: '2024', title: 'Global Expansion', description: '500+ enterprise customers across 30 countries.' },
];

const stats = [
  { value: '500+', label: 'Enterprise Customers' },
  { value: '10M+', label: 'Contracts Processed' },
  { value: '30+', label: 'Countries' },
  { value: '50+', label: 'Team Members' },
];

export default function AboutPage() {
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
                  className={`text-sm font-medium transition-colors ${
                    item === 'About' ? 'text-white' : 'text-slate-400 hover:text-white'
                  }`}
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

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 mb-8">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300">Our Story</span>
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold">
              <span className="text-white">Transforming How the</span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                World Manages Contracts
              </span>
            </h1>
            <p className="mt-6 text-xl text-slate-400 max-w-3xl mx-auto">
              We believe that managing contracts shouldn&apos;t require an army of lawyers or endless hours 
              of manual review. ConTigo uses AI to make contract intelligence accessible to everyone.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="mt-2 text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
              <p className="text-lg text-slate-400 leading-relaxed mb-6">
                Contracts are the backbone of business relationships, yet managing them has remained 
                stuck in the past. Legal teams spend countless hours searching for information, 
                tracking deadlines, and extracting key terms manually.
              </p>
              <p className="text-lg text-slate-400 leading-relaxed">
                We&apos;re on a mission to change that. By combining cutting-edge AI with intuitive design, 
                ConTigo transforms contract management from a burden into a competitive advantage.
              </p>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl p-8 border border-white/5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Globe, label: 'Global Scale' },
                    { icon: Zap, label: 'AI-Powered' },
                    { icon: Award, label: 'Industry Leader' },
                    { icon: Users, label: 'Customer Focused' },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/5 rounded-xl p-4 text-center">
                      <item.icon className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                      <span className="text-sm text-slate-300">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">Our Values</h2>
            <p className="mt-4 text-lg text-slate-400">
              The principles that guide everything we do
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div
                key={value.title}
                className="group bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 hover:border-white/10 transition-all"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${value.gradient} rounded-xl flex items-center justify-center mb-4 shadow-lg transition-transform group-hover:scale-110`}>
                  <value.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{value.title}</h3>
                <p className="text-slate-400">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">Our Journey</h2>
            <p className="mt-4 text-lg text-slate-400">
              From idea to industry leader
            </p>
          </div>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500 to-purple-500" />
            
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.year}
                  className={`relative flex items-center gap-8 ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Dot */}
                  <div className="absolute left-4 md:left-1/2 w-3 h-3 bg-indigo-500 rounded-full -translate-x-1/2 ring-4 ring-slate-900" />
                  
                  <div className={`flex-1 ml-12 md:ml-0 ${index % 2 === 0 ? 'md:pr-16 md:text-right' : 'md:pl-16'}`}>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-6">
                      <span className="text-indigo-400 font-bold">{milestone.year}</span>
                      <h3 className="text-xl font-semibold text-white mt-1">{milestone.title}</h3>
                      <p className="text-slate-400 mt-2">{milestone.description}</p>
                    </div>
                  </div>
                  
                  <div className="hidden md:block flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Join Our Journey
          </h2>
          <p className="mt-4 text-lg text-indigo-100 max-w-2xl mx-auto">
            Be part of the contract management revolution. Get started today.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signin"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-indigo-600 shadow-2xl transition-all hover:bg-slate-100 hover:scale-105"
            >
              Get Started
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/50"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white">ConTigo</span>
            </Link>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} ConTigo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
