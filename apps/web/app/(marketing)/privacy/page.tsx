import { 
  FileText, 
  ArrowRight,
  Shield,
  Lock,
  Eye,
  Database,
  Globe,
  Users,
  Trash2,
  Mail
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - ConTigo',
  description: 'Learn how ConTigo protects your privacy and handles your personal data.',
};

const sections = [
  {
    icon: Database,
    title: 'Information We Collect',
    content: [
      'Account information (name, email, company)',
      'Contract documents you upload for processing',
      'Usage data and analytics to improve our service',
      'Technical information (IP address, browser type, device info)',
      'Communications with our support team',
    ],
  },
  {
    icon: Eye,
    title: 'How We Use Your Information',
    content: [
      'To provide and maintain our contract intelligence services',
      'To process and analyze your contracts using AI',
      'To send important service updates and notifications',
      'To improve our AI models and user experience',
      'To ensure platform security and prevent fraud',
    ],
  },
  {
    icon: Shield,
    title: 'Data Protection',
    content: [
      'AES-256 encryption for all data at rest',
      'TLS 1.3 encryption for data in transit',
      'Data stored in Swiss data centers with strict privacy laws',
      'Regular security audits and penetration testing',
      'SOC 2 Type II certified infrastructure',
    ],
  },
  {
    icon: Users,
    title: 'Data Sharing',
    content: [
      'We never sell your personal data to third parties',
      'Contract content is never used to train public AI models',
      'We only share data with service providers under strict agreements',
      'We may disclose data if required by law or court order',
      'You control who in your organization can access your data',
    ],
  },
  {
    icon: Globe,
    title: 'International Transfers',
    content: [
      'All data is primarily stored in Switzerland',
      'We comply with GDPR for EU/EEA data subjects',
      'Standard Contractual Clauses for necessary transfers',
      'Privacy Shield framework compliance where applicable',
      'Data Processing Agreements available upon request',
    ],
  },
  {
    icon: Trash2,
    title: 'Data Retention & Deletion',
    content: [
      'Active account data retained while you use the service',
      'Deleted contracts permanently removed within 30 days',
      'Account deletion available at any time via settings',
      'Backup retention limited to 90 days',
      'Legal hold provisions for compliance requirements',
    ],
  },
];

const rights = [
  { title: 'Access', description: 'Request a copy of your personal data' },
  { title: 'Rectification', description: 'Correct inaccurate personal data' },
  { title: 'Erasure', description: 'Request deletion of your data' },
  { title: 'Portability', description: 'Export your data in standard formats' },
  { title: 'Restriction', description: 'Limit how we process your data' },
  { title: 'Objection', description: 'Object to certain processing activities' },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="group flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/25">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                ConTigo
              </span>
            </Link>
            
            <Link
              href="/auth/signin"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-105"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 mb-8">
              <Lock className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-300">Your Privacy Matters</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-bold text-white">
              Privacy Policy
            </h1>
            <p className="mt-6 text-xl text-slate-400">
              Last updated: January 15, 2026
            </p>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <p className="text-lg text-slate-300 leading-relaxed">
              At ConTigo, we take your privacy seriously. This policy explains how we collect, 
              use, and protect your personal information when you use our contract intelligence 
              platform. We are committed to GDPR compliance and maintaining the highest standards 
              of data protection.
            </p>
          </div>
        </div>
      </section>

      {/* Main Sections */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
          {sections.map((section, index) => (
            <div
              key={index}
              className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/[0.07] transition-colors"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <section.icon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">{section.title}</h2>
              </div>
              <ul className="space-y-3">
                {section.content.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2.5 flex-shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Your Rights */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Your Rights</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rights.map((right) => (
              <div
                key={right.title}
                className="bg-white/5 border border-white/5 rounded-xl p-5 hover:bg-white/10 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white mb-2">{right.title}</h3>
                <p className="text-sm text-slate-400">{right.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/10 border border-white/10 rounded-2xl p-8 text-center">
            <Mail className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Questions About Privacy?</h2>
            <p className="text-slate-300 mb-6">
              Contact our Data Protection Officer at{' '}
              <a href="mailto:privacy@contigo.io" className="text-indigo-400 hover:text-indigo-300">
                privacy@contigo.io
              </a>
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 transition-colors"
            >
              Contact Us
              <ArrowRight className="h-4 w-4" />
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
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/privacy" className="text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/security" className="hover:text-white transition-colors">Security</Link>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} ConTigo
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
