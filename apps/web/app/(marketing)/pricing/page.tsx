import { 
  Check, 
  FileText, 
  ArrowRight,
  Sparkles,
  Building2,
  Users,
  Zap,
  Shield,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Pricing - ConTigo',
  description: 'Simple, transparent pricing for teams of all sizes. Start free, scale as you grow.',
};

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for small teams getting started',
    price: '49',
    period: '/month',
    icon: Users,
    gradient: 'from-slate-500 to-slate-600',
    features: [
      'Up to 100 contracts',
      '3 team members',
      'Basic AI extraction',
      'Email alerts',
      'Standard support',
      '5GB storage',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    description: 'For growing teams that need more power',
    price: '149',
    period: '/month',
    icon: Zap,
    gradient: 'from-indigo-500 to-purple-600',
    features: [
      'Up to 1,000 contracts',
      '10 team members',
      'Advanced AI analysis',
      'Obligation tracking',
      'API access',
      'Slack & Teams integration',
      'Priority support',
      '50GB storage',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    description: 'For organizations with advanced needs',
    price: 'Custom',
    period: '',
    icon: Building2,
    gradient: 'from-emerald-500 to-cyan-600',
    features: [
      'Unlimited contracts',
      'Unlimited team members',
      'Custom AI models',
      'Advanced security (SSO, SAML)',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantees',
      'On-premise option',
      'Unlimited storage',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const faqs = [
  {
    question: 'How does the free trial work?',
    answer: 'Start with a 14-day free trial of any plan. No credit card required. You can upgrade, downgrade, or cancel at any time.',
  },
  {
    question: 'What counts as a "contract"?',
    answer: 'A contract is any document you upload for analysis. This includes agreements, amendments, and supporting documents. Archived contracts don\'t count toward your limit.',
  },
  {
    question: 'Can I change plans later?',
    answer: 'Yes! You can upgrade or downgrade at any time. Changes take effect immediately, and we\'ll prorate your billing.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. We use bank-grade encryption, host data in Swiss data centers, and are SOC 2 Type II certified. Your contracts are never used to train AI models.',
  },
  {
    question: 'Do you offer discounts for annual billing?',
    answer: 'Yes, you can save 20% by choosing annual billing. Contact us for volume discounts on Enterprise plans.',
  },
  {
    question: 'What integrations are available?',
    answer: 'We integrate with Salesforce, DocuSign, SharePoint, Google Drive, Slack, Microsoft Teams, and 50+ other tools. Custom integrations are available on Enterprise plans.',
  },
];

export default function PricingPage() {
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
                    item === 'Pricing' ? 'text-white' : 'text-slate-400 hover:text-white'
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
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 mb-8">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300">Simple, Transparent Pricing</span>
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold">
              <span className="text-white">Plans That</span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Scale With You
              </span>
            </h1>
            <p className="mt-6 text-xl text-slate-400 max-w-2xl mx-auto">
              Start free, no credit card required. Upgrade when you&apos;re ready.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-b from-indigo-500/20 to-purple-500/10 border-2 border-indigo-500/50 scale-105'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-1 text-sm font-semibold text-white">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className={`w-12 h-12 bg-gradient-to-br ${plan.gradient} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                  <plan.icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-slate-400 mt-1">{plan.description}</p>
                
                <div className="mt-6 flex items-baseline gap-1">
                  {plan.price !== 'Custom' && <span className="text-slate-400">$</span>}
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.period && <span className="text-slate-400">{plan.period}</span>}
                </div>
                
                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link
                  href={plan.name === 'Enterprise' ? '/contact' : '/auth/signin'}
                  className={`mt-8 block w-full text-center py-3 px-6 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white">All Plans Include</h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, label: 'Bank-grade encryption' },
              { icon: Zap, label: 'Fast AI processing' },
              { icon: Users, label: 'Role-based access' },
              { icon: HelpCircle, label: '24/7 email support' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 bg-white/5 rounded-xl p-4 border border-white/5">
                <item.icon className="w-5 h-5 text-indigo-400" />
                <span className="text-slate-300 text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">Frequently Asked Questions</h2>
            <p className="mt-4 text-lg text-slate-400">
              Everything you need to know about our pricing
            </p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white/5 border border-white/5 rounded-xl p-6 hover:bg-white/10 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-400" />
                  {faq.question}
                </h3>
                <p className="mt-3 text-slate-400 ml-7">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to Get Started?
          </h2>
          <p className="mt-4 text-lg text-indigo-100 max-w-2xl mx-auto">
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signin"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-indigo-600 shadow-2xl transition-all hover:bg-slate-100 hover:scale-105"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/50"
            >
              Talk to Sales
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
