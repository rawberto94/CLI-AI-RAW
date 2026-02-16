import type { Metadata } from 'next';
import { 
  ArrowRight,
  Sparkles,
  Target,
  Heart,
  Lightbulb,
  Users,
  Globe,
  Award,
  Zap,
  Database,
  Shield,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About ConTigo — Swiss-Made AI Contract Intelligence',
  description:
    'ConTigo was founded in Zürich by three professionals from procurement consulting, managed services, and data architecture. Learn about the team behind the platform.',
};

const founders = [
  {
    name: 'Roberto Ostojic',
    subtitle: 'Technical Founder',
    role: 'CEO & CTO',
    description:
      'Creator of the core ConTigo product and codebase. Roberto combines deep technical expertise with hands-on procurement consulting experience to architect a platform that truly understands contract workflows.',
    gradient: 'from-violet-500 to-purple-600',
    initial: 'RO',
  },
  {
    name: 'Florian Herhold',
    subtitle: 'Commercial Founder',
    role: 'CCO',
    description:
      'Florian drives go-to-market strategy, sales, and partnerships. Years of experience in procurement consulting and managed services give him first-hand insight into the challenges enterprises face daily.',
    gradient: 'from-purple-500 to-fuchsia-600',
    initial: 'FH',
  },
  {
    name: 'Daniel Bartholy',
    subtitle: 'Data Founder',
    role: 'Chief Data Architecture',
    description:
      'Daniel owns the data model, integrations, data architecture, and analytics foundations. His expertise ensures ConTigo turns unstructured contract data into structured, actionable intelligence.',
    gradient: 'from-fuchsia-500 to-pink-600',
    initial: 'DB',
  },
];

const values = [
  {
    icon: Target,
    title: 'Practitioner-Built',
    description: 'We\'ve managed procurement for leading enterprises. We know the pain — and we built the cure.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Lightbulb,
    title: 'AI-First Innovation',
    description: 'We push the boundaries of what AI can do for contract management — extraction, risk analysis, and beyond.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Heart,
    title: 'Swiss Trust & Security',
    description: 'We treat your data with Swiss-grade precision and care. Security and compliance are non-negotiable.',
    gradient: 'from-pink-500 to-pink-600',
  },
  {
    icon: Users,
    title: 'Customer Collaboration',
    description: 'Every feature we build starts with a real customer need. Your success drives our roadmap.',
    gradient: 'from-violet-500 to-purple-600',
  },
];

const milestones = [
  { year: '2023', title: 'Founded in Zürich', description: 'Three professionals from procurement consulting and data architecture came together with a shared vision.' },
  { year: '2024', title: 'Platform Built', description: 'Built the AI engine, OCR pipeline, and core platform with Swiss engineering quality and real-world procurement DNA.' },
  { year: '2025', title: 'Enterprise Launch', description: 'Full production launch with AI contract intelligence, Swiss data residency, and enterprise-grade security.' },
  { year: '2026', title: 'Scaling Up', description: 'Expanding across industries, deepening AI capabilities, and growing the team from our Zürich home.' },
];

const stats = [
  { value: 'Zürich', label: 'Founded & Based' },
  { value: '3', label: 'Co-Founders' },
  { value: '18+', label: 'Artifact Types Extracted' },
  { value: '<3s', label: 'Avg. Analysis Time' },
];

export default function AboutPage() {
  return (
    <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-16 pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 mb-8">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-300">Our Story</span>
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold">
              <span className="text-white">Born in Zürich.</span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Built by Practitioners.
              </span>
            </h1>
            <p className="mt-6 text-xl text-slate-400 max-w-3xl mx-auto">
              ConTigo was founded by three professionals who lived the pain of contract management every day — 
              two from procurement consulting and managed services, one from data architecture. 
              We built the intelligent platform we always wished existed.
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
                <div className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="mt-2 text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founders */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">The Founding Team</h2>
            <p className="mt-4 text-lg text-slate-400">
              Procurement expertise meets technical innovation
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {founders.map((founder) => (
              <div
                key={founder.name}
                className="group bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/10 hover:border-white/10 transition-all text-center"
              >
                {/* Avatar */}
                <div className={`w-24 h-24 mx-auto mb-6 bg-gradient-to-br ${founder.gradient} rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                  <span className="text-2xl font-bold text-white">{founder.initial}</span>
                </div>

                <h3 className="text-xl font-semibold text-white mb-1">{founder.name}</h3>
                <p className="text-sm text-violet-400 font-semibold mb-1">{founder.role}</p>
                <p className="text-xs text-slate-500 mb-4">{founder.subtitle}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{founder.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-violet-400" />
                <span className="text-violet-400 font-medium text-sm">Zürich, Switzerland</span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-6">Why We Started ConTigo</h2>
              <p className="text-lg text-slate-400 leading-relaxed mb-6">
                As procurement consultants and managed services providers, Roberto and Florian spent years dealing with the same problem: 
                contracts trapped in PDFs, manual tracking in spreadsheets, missed renewal dates, 
                and legal teams drowning in document review.
              </p>
              <p className="text-lg text-slate-400 leading-relaxed mb-6">
                When Daniel joined with his deep data architecture expertise, the vision became clear — 
                build an AI-powered platform that not only stores contracts but truly <em className="text-white">understands</em> them. 
                One that extracts every clause, every obligation, every date — automatically.
              </p>
              <p className="text-lg text-slate-400 leading-relaxed">
                That&apos;s ConTigo: Swiss-engineered AI contract intelligence, built by the people who know 
                the pain of procurement first-hand.
              </p>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-3xl p-8 border border-white/5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Globe, label: 'Global Scale' },
                    { icon: Zap, label: 'AI-Powered' },
                    { icon: Award, label: 'Swiss Quality' },
                    { icon: Shield, label: 'Enterprise Security' },
                    { icon: Database, label: 'Data-Driven' },
                    { icon: Users, label: 'Practitioner-Built' },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/5 rounded-xl p-4 text-center">
                      <item.icon className="w-8 h-8 text-violet-400 mx-auto mb-2" />
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
              From consulting pain to intelligent platform
            </p>
          </div>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500 to-purple-500" />
            
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.year}
                  className={`relative flex items-center gap-8 ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Dot */}
                  <div className="absolute left-4 md:left-1/2 w-3 h-3 bg-violet-500 rounded-full -translate-x-1/2 ring-4 ring-slate-900" />
                  
                  <div className={`flex-1 ml-12 md:ml-0 ${index % 2 === 0 ? 'md:pr-16 md:text-right' : 'md:pl-16'}`}>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-6">
                      <span className="text-violet-400 font-bold">{milestone.year}</span>
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
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Join Our Journey
          </h2>
          <p className="mt-4 text-lg text-indigo-100 max-w-2xl mx-auto">
            Built by practitioners, for practitioners. See how ConTigo can transform your contract management.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signin"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-violet-600 shadow-2xl transition-all hover:bg-slate-100 hover:scale-105"
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

    </div>
  );
}
