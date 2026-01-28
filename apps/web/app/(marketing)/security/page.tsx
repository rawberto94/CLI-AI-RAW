import { 
  FileText, 
  ArrowRight,
  Shield,
  Lock,
  Server,
  Eye,
  Key,
  CheckCircle,
  Globe,
  AlertTriangle,
  RefreshCw,
  Users
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Security - ConTigo',
  description: 'Learn about ConTigo enterprise-grade security measures protecting your contracts.',
};

const certifications = [
  {
    title: 'SOC 2 Type II',
    description: 'Annual third-party audit of security controls',
    icon: CheckCircle,
  },
  {
    title: 'GDPR Compliant',
    description: 'Full EU data protection compliance',
    icon: Globe,
  },
  {
    title: 'ISO 27001',
    description: 'Information security management certified',
    icon: Shield,
  },
  {
    title: 'Swiss Hosting',
    description: 'Data stored in Swiss data centers',
    icon: Server,
  },
];

const securityFeatures = [
  {
    icon: Lock,
    title: 'Encryption at Rest',
    description: 'All data encrypted with AES-256, the same standard used by banks and governments.',
    color: 'from-violet-500 to-violet-600',
  },
  {
    icon: Key,
    title: 'Encryption in Transit',
    description: 'TLS 1.3 encryption for all data transmission, with certificate pinning.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    icon: Shield,
    title: 'Zero-Knowledge Architecture',
    description: 'Your encryption keys are unique to your organization. We cannot access your data.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    icon: Users,
    title: 'Access Controls',
    description: 'Role-based permissions, SSO integration, and multi-factor authentication.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    icon: Eye,
    title: 'Audit Logging',
    description: 'Complete audit trail of all actions with tamper-proof logging.',
    color: 'from-pink-500 to-pink-600',
  },
  {
    icon: RefreshCw,
    title: 'Business Continuity',
    description: 'Automated backups, disaster recovery, and 99.9% uptime SLA.',
    color: 'from-amber-500 to-amber-600',
  },
];

const practices = [
  {
    title: 'Penetration Testing',
    description: 'Quarterly penetration tests by independent security firms to identify vulnerabilities.',
  },
  {
    title: 'Bug Bounty Program',
    description: 'We reward security researchers who responsibly disclose vulnerabilities.',
  },
  {
    title: 'Security Training',
    description: 'All employees complete regular security awareness training.',
  },
  {
    title: 'Incident Response',
    description: '24/7 security monitoring with documented incident response procedures.',
  },
  {
    title: 'Vendor Assessment',
    description: 'Rigorous security review of all third-party vendors and integrations.',
  },
  {
    title: 'Code Review',
    description: 'All code changes undergo security review before deployment.',
  },
];

export default function SecurityPage() {
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
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 mb-8">
              <Shield className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-300">Enterprise-Grade Security</span>
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold">
              <span className="text-white">Your Contracts,</span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-purple-400 bg-clip-text text-transparent">
                Fully Protected
              </span>
            </h1>
            <p className="mt-6 text-xl text-slate-400 max-w-2xl mx-auto">
              Bank-grade security for your most sensitive documents. Your trust is our top priority.
            </p>
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {certifications.map((cert) => (
              <div
                key={cert.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-colors"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <cert.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{cert.title}</h3>
                <p className="text-sm text-slate-400">{cert.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">
              Security at Every Layer
            </h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
              Multiple layers of protection ensure your data stays safe
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityFeatures.map((feature) => (
              <div
                key={feature.title}
                className="group bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 hover:border-white/10 transition-all"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-lg transition-transform group-hover:scale-110`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Practices */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Our Security Practices</h2>
              <p className="text-lg text-slate-400 mb-8">
                Security isn&apos;t just a feature—it&apos;s embedded in everything we do. 
                From how we write code to how we operate our infrastructure.
              </p>
              <div className="space-y-4">
                {practices.map((practice) => (
                  <div
                    key={practice.title}
                    className="flex items-start gap-4"
                  >
                    <div className="w-6 h-6 bg-violet-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{practice.title}</h3>
                      <p className="text-sm text-slate-400">{practice.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-violet-500/20 to-purple-500/10 rounded-3xl p-8 border border-white/10">
                <div className="space-y-6">
                  {/* Security Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-violet-400">99.9%</div>
                      <div className="text-sm text-slate-400">Uptime SLA</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-purple-400">0</div>
                      <div className="text-sm text-slate-400">Data Breaches</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-indigo-400">24/7</div>
                      <div className="text-sm text-slate-400">Monitoring</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-purple-400">&lt;1hr</div>
                      <div className="text-sm text-slate-400">Response Time</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Report Vulnerability */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Found a Vulnerability?</h2>
                <p className="text-slate-300 mb-4">
                  We appreciate responsible disclosure. If you&apos;ve found a security issue, 
                  please report it to our security team.
                </p>
                <a
                  href="mailto:security@contigo.io"
                  className="inline-flex items-center gap-2 text-amber-400 font-semibold hover:text-amber-300 transition-colors"
                >
                  security@contigo.io
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to Secure Your Contracts?
          </h2>
          <p className="mt-4 text-lg text-violet-100 max-w-2xl mx-auto">
            Join hundreds of enterprises trusting ConTigo with their sensitive documents.
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
              Request Security Docs
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
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/security" className="text-white">Security</Link>
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
