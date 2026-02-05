import { 
  FileSearch, 
  Brain, 
  MessageSquare, 
  Clock, 
  Shield, 
  Zap as _Zap, 
  BarChart3, 
  FileText,
  Search,
  Bell,
  Lock,
  Users,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Globe,
  Server
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Features - ConTigo',
  description: 'Discover how ConTigo AI-powered features transform contract management for modern enterprises.',
};

const mainFeatures = [
  {
    icon: FileSearch,
    title: 'Smart Document Processing',
    description: 'Upload contracts in any format — PDF, Word, scanned images. Our AI extracts and organizes key information automatically.',
    details: [
      'OCR for scanned documents',
      'Multi-language support',
      'Batch upload capability',
      'Automatic categorization',
    ],
    gradient: 'from-purple-500 to-purple-600',
    bgGradient: 'from-purple-500/20 to-purple-600/10',
  },
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    description: 'Advanced language models understand contract language, identify key clauses, and extract structured data with high accuracy.',
    details: [
      'Key term extraction',
      'Obligation identification',
      'Risk flagging',
      'Compliance checking',
    ],
    gradient: 'from-purple-500 to-purple-600',
    bgGradient: 'from-purple-500/20 to-purple-600/10',
  },
  {
    icon: MessageSquare,
    title: 'Natural Language Chat',
    description: 'Ask questions about your contracts in plain English. Get instant, accurate answers with citations to source documents.',
    details: [
      'Context-aware responses',
      'Source citations',
      'Multi-contract queries',
      'Follow-up questions',
    ],
    gradient: 'from-pink-500 to-pink-600',
    bgGradient: 'from-pink-500/20 to-pink-600/10',
  },
  {
    icon: Clock,
    title: 'Deadline & Obligation Tracking',
    description: 'Never miss a renewal or obligation deadline. Automated monitoring and alerts keep your team proactive.',
    details: [
      'Automatic date extraction',
      'Customizable reminders',
      'Calendar integration',
      'Escalation workflows',
    ],
    gradient: 'from-purple-500 to-purple-600',
    bgGradient: 'from-purple-500/20 to-purple-600/10',
  },
];

const additionalFeatures = [
  {
    icon: Search,
    title: 'Intelligent Search',
    description: 'Find any clause across thousands of contracts instantly with semantic search.',
    gradient: 'from-violet-500 to-violet-600',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Visual insights into your contract portfolio — expirations, values, and trends.',
    gradient: 'from-amber-500 to-amber-600',
  },
  {
    icon: FileText,
    title: 'Export & Reporting',
    description: 'Generate reports and export data in multiple formats for stakeholders.',
    gradient: 'from-rose-500 to-rose-600',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Customizable alerts via email, Slack, or Teams for critical updates.',
    gradient: 'from-violet-500 to-violet-600',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Share insights, assign tasks, and collaborate on contract reviews.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Lock,
    title: 'Access Control',
    description: 'Granular permissions ensure the right people see the right contracts.',
    gradient: 'from-slate-500 to-slate-600',
  },
];

const securityFeatures = [
  {
    icon: Globe,
    title: 'Swiss Data Hosting',
    description: 'All data stored in Swiss data centers, protected by strict privacy laws.',
  },
  {
    icon: Lock,
    title: 'End-to-End Encryption',
    description: 'AES-256 encryption for data at rest and TLS 1.3 for data in transit.',
  },
  {
    icon: Shield,
    title: 'GDPR Compliant',
    description: 'Full compliance with European data protection regulations.',
  },
  {
    icon: Server,
    title: 'SOC 2 Type II',
    description: 'Independently audited security controls and processes.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="group flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/25 transition-all group-hover:shadow-purple-500/40">
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
                    item === 'Features' ? 'text-white' : 'text-slate-400 hover:text-white'
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
                className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-105"
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
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 mb-8">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300">Enterprise-Grade Features</span>
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold">
              <span className="text-white">Powerful Features for</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Modern Teams
              </span>
            </h1>
            <p className="mt-6 text-xl text-slate-400 max-w-2xl mx-auto">
              Everything you need to manage contracts intelligently, from upload to insight.
            </p>
          </div>
        </div>
      </section>

      {/* Main Features */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-24">
            {mainFeatures.map((feature, index) => (
              <div 
                key={feature.title}
                className={`grid lg:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">
                    {feature.title}
                  </h2>
                  <p className="text-lg text-slate-400 mb-6">
                    {feature.description}
                  </p>
                  <ul className="space-y-3">
                    {feature.details.map((detail) => (
                      <li key={detail} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-violet-400 flex-shrink-0" />
                        <span className="text-slate-300">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <div className={`bg-gradient-to-br ${feature.bgGradient} rounded-3xl p-8 aspect-square flex items-center justify-center border border-white/5`}>
                    <feature.icon className="w-32 h-32 text-white/20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">And Much More</h2>
            <p className="mt-4 text-lg text-slate-400">
              Additional capabilities to supercharge your workflow
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {additionalFeatures.map((feature) => (
              <div 
                key={feature.title}
                className="group bg-white/5 border border-white/5 p-6 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 shadow-lg transition-transform group-hover:scale-110`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-purple-500/10 p-12 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">Enterprise Security</h2>
              </div>
              <p className="text-lg text-slate-300 max-w-2xl mb-10">
                Your contracts contain sensitive information. We protect them with industry-leading security measures.
              </p>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {securityFeatures.map((feature) => (
                  <div key={feature.title} className="bg-white/5 rounded-xl p-5 border border-white/5">
                    <feature.icon className="h-8 w-8 text-violet-400 mb-3" />
                    <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to Experience These Features?
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Request a demo today and see how ConTigo can transform your contract management.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signin"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-2xl shadow-purple-500/30 transition-all hover:shadow-purple-500/50 hover:scale-105"
            >
              Get Started
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600">
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
