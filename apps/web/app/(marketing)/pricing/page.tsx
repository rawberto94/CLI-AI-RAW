'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Check,
  X,
  ArrowRight,
  Shield,
  ChevronDown,
  Mail,
  Phone,
  Globe,
  Clock,
  Lock,
  Star,
  Award,
  Menu,
  HelpCircle,
  ChevronRight,
  Users,
  Zap,
  Send,
  Loader2,
  CheckCircle2,
  Briefcase,
  Building,
  Rocket
} from 'lucide-react';

// Mobile Menu Component
function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl p-6">
        <div className="flex items-center justify-between mb-8">
          <Image src="/logo.png" alt="ConTigo" width={120} height={32} className="h-8 w-auto" />
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="space-y-4">
          {['Features', 'Solutions', 'Pricing', 'Resources'].map((item) => (
            <Link 
              key={item} 
              href={item === 'Pricing' ? '/pricing' : `/#${item.toLowerCase()}`}
              className="block py-3 text-gray-700 hover:text-teal-600 font-medium border-b border-gray-100"
              onClick={onClose}
            >
              {item}
            </Link>
          ))}
          <div className="pt-6 space-y-3">
            <Link href="/auth/signin" className="block w-full text-center py-3 text-gray-700 border border-gray-200 rounded-xl font-medium">
              Sign In
            </Link>
            <Link href="/auth/signin" className="block w-full text-center py-3 bg-teal-600 text-white rounded-xl font-medium">
              Start Free Trial
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
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

// Plans data - no prices shown, based on actual app features
const plans = [
  {
    name: 'Starter',
    description: 'Essential contract management for small teams getting organized',
    icon: Rocket,
    gradient: 'from-blue-500 to-cyan-500',
    idealFor: 'Small teams (1-10 users)',
    features: [
      'Up to 10 users',
      '500 contracts storage',
      'PDF, DOCX, TXT upload with OCR',
      'AI artifact extraction (overview, financial, obligations)',
      'Smart semantic search',
      'Renewal alerts & deadline tracking',
      'Basic dashboards & KPIs',
      'AI Chatbot (basic queries)',
      'Comments & activity feed',
      'Email notifications',
      '2FA authentication',
      'Email support (48h response)',
    ],
  },
  {
    name: 'Professional',
    description: 'Advanced intelligence & workflows for growing procurement teams',
    icon: Briefcase,
    gradient: 'from-teal-500 to-emerald-500',
    idealFor: 'Growing teams (10-50 users)',
    popular: true,
    features: [
      'Up to 50 users',
      'Unlimited contracts',
      'Full AI artifact suite (18+ types including risk, compliance, clauses)',
      'Risk assessment & scoring',
      'Contract comparison (side-by-side AI diff)',
      'Rate card analysis & benchmarking',
      'Custom approval workflows',
      'Obligation tracking with deadlines',
      'Procurement analytics & spend analysis',
      'AI Chatbot with deep analysis capabilities',
      'Clause library with risk classification',
      'API access & webhooks',
      'Microsoft 365 & Google Drive integration',
      'SSO/SAML authentication',
      'Real-time WebSocket notifications',
      'Priority support (4h response)',
    ],
  },
  {
    name: 'Enterprise',
    description: 'Full platform with advanced security, compliance & customization',
    icon: Building,
    gradient: 'from-purple-500 to-indigo-500',
    idealFor: 'Large organizations (50+ users)',
    features: [
      'Unlimited users & contracts',
      'Custom AI model fine-tuning',
      'Multi-tenant workspace isolation',
      'Advanced workflow automation with escalations',
      'E-signature integrations (DocuSign, Adobe Sign, HelloSign)',
      'Full ERP integration (SAP, Coupa)',
      'Knowledge graph & entity relationships',
      'AI contract generation & drafting',
      'Negotiation assistant with market intelligence',
      'Custom reporting & BI export',
      'SSO/SAML + SCIM user provisioning',
      'Unlimited audit log retention',
      'Dedicated account manager',
      'On-premise / private cloud deployment',
      'FINMA, ISO 27001 & SOC 2 Type II compliance',
      '24/7 premium support (1h response)',
      'Custom SLA (up to 99.99% uptime)',
    ],
  },
];

// Feature comparison data - based on actual app capabilities
const comparisonCategories = [
  {
    name: 'Contract Management',
    features: [
      { name: 'Contract storage', starter: '500 contracts', professional: 'Unlimited', enterprise: 'Unlimited' },
      { name: 'File formats (PDF, DOCX, TXT)', starter: true, professional: true, enterprise: true },
      { name: 'OCR for scanned documents', starter: true, professional: true, enterprise: true },
      { name: 'Bulk upload & batch processing', starter: true, professional: true, enterprise: true },
      { name: 'Version history & amendments', starter: '90 days', professional: '2 years', enterprise: 'Unlimited' },
      { name: 'Contract hierarchy (MSA → SOW)', starter: false, professional: true, enterprise: true },
      { name: 'Soft delete with recovery', starter: true, professional: true, enterprise: true },
    ],
  },
  {
    name: 'AI Extraction & Analysis',
    features: [
      { name: 'Overview & summary extraction', starter: true, professional: true, enterprise: true },
      { name: 'Financial terms & rate tables', starter: true, professional: true, enterprise: true },
      { name: 'Parties & obligations extraction', starter: true, professional: true, enterprise: true },
      { name: 'Risk analysis & scoring', starter: false, professional: true, enterprise: true },
      { name: 'Compliance assessment', starter: false, professional: true, enterprise: true },
      { name: 'Clause extraction & categorization', starter: false, professional: true, enterprise: true },
      { name: 'Termination & liability clauses', starter: false, professional: true, enterprise: true },
      { name: 'SLA terms detection', starter: false, professional: true, enterprise: true },
      { name: 'Negotiation points suggestion', starter: false, professional: true, enterprise: true },
      { name: 'Multi-pass AI processing', starter: false, professional: true, enterprise: true },
      { name: 'Custom AI model fine-tuning', starter: false, professional: false, enterprise: true },
    ],
  },
  {
    name: 'AI Chatbot & Intelligence',
    features: [
      { name: 'Natural language Q&A', starter: 'Basic', professional: 'Advanced', enterprise: 'Unlimited' },
      { name: 'Semantic search (RAG)', starter: true, professional: true, enterprise: true },
      { name: 'Contract comparison', starter: false, professional: true, enterprise: true },
      { name: 'Deep analysis queries', starter: false, professional: true, enterprise: true },
      { name: 'Cross-contract intelligence', starter: false, professional: true, enterprise: true },
      { name: 'Agentic workflows (renew, approve, generate)', starter: false, professional: true, enterprise: true },
      { name: 'Proactive insights & alerts', starter: false, professional: true, enterprise: true },
      { name: 'AI contract generation', starter: false, professional: false, enterprise: true },
      { name: 'Negotiation assistant', starter: false, professional: false, enterprise: true },
    ],
  },
  {
    name: 'Rate Cards & Procurement',
    features: [
      { name: 'Rate card extraction', starter: false, professional: true, enterprise: true },
      { name: 'Rate benchmarking & comparison', starter: false, professional: true, enterprise: true },
      { name: 'Supplier scoring & ranking', starter: false, professional: true, enterprise: true },
      { name: 'Spend analysis by category', starter: false, professional: true, enterprise: true },
      { name: 'Cost savings identification', starter: false, professional: true, enterprise: true },
      { name: 'Geographic rate analysis', starter: false, professional: false, enterprise: true },
      { name: 'Market intelligence', starter: false, professional: false, enterprise: true },
    ],
  },
  {
    name: 'Workflows & Collaboration',
    features: [
      { name: 'Team workspaces', starter: '1', professional: 'Unlimited', enterprise: 'Unlimited' },
      { name: 'User roles & permissions', starter: 'Basic', professional: 'Advanced', enterprise: 'Custom RBAC' },
      { name: 'Comments & @mentions', starter: true, professional: true, enterprise: true },
      { name: 'Activity feed', starter: true, professional: true, enterprise: true },
      { name: 'Approval workflows', starter: false, professional: true, enterprise: true },
      { name: 'Multi-step workflow builder', starter: false, professional: true, enterprise: true },
      { name: 'Workflow escalations & SLA', starter: false, professional: false, enterprise: true },
      { name: 'External document sharing', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    name: 'Renewals & Deadlines',
    features: [
      { name: 'Renewal alerts (30/60/90 days)', starter: true, professional: true, enterprise: true },
      { name: 'Obligation deadline tracking', starter: true, professional: true, enterprise: true },
      { name: 'Contract health scoring', starter: false, professional: true, enterprise: true },
      { name: 'Renewal workflow automation', starter: false, professional: true, enterprise: true },
      { name: 'Custom alert rules', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    name: 'Analytics & Reporting',
    features: [
      { name: 'Dashboard KPIs', starter: 'Basic', professional: 'Full suite', enterprise: 'Custom' },
      { name: 'Procurement analytics', starter: false, professional: true, enterprise: true },
      { name: 'Supplier performance reports', starter: false, professional: true, enterprise: true },
      { name: 'Savings tracking', starter: false, professional: true, enterprise: true },
      { name: 'Custom report builder', starter: false, professional: true, enterprise: true },
      { name: 'Scheduled report delivery', starter: false, professional: false, enterprise: true },
      { name: 'BI tool export (Power BI, Tableau)', starter: false, professional: false, enterprise: true },
    ],
  },
  {
    name: 'Security & Compliance',
    features: [
      { name: 'Data encryption (AES-256)', starter: true, professional: true, enterprise: true },
      { name: 'Swiss data residency', starter: true, professional: true, enterprise: true },
      { name: 'Two-factor authentication', starter: true, professional: true, enterprise: true },
      { name: 'SSO/SAML integration', starter: false, professional: true, enterprise: true },
      { name: 'SCIM user provisioning', starter: false, professional: false, enterprise: true },
      { name: 'Audit logs', starter: '90 days', professional: '2 years', enterprise: 'Unlimited' },
      { name: 'GDPR compliance', starter: true, professional: true, enterprise: true },
      { name: 'SOC 2 Type II certification', starter: false, professional: true, enterprise: true },
      { name: 'FINMA compliance tools', starter: false, professional: false, enterprise: true },
      { name: 'ISO 27001 certification', starter: false, professional: false, enterprise: true },
      { name: 'Multi-tenant data isolation', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    name: 'Integrations & API',
    features: [
      { name: 'REST API access', starter: false, professional: true, enterprise: true },
      { name: 'Webhooks', starter: false, professional: true, enterprise: true },
      { name: 'Microsoft 365 / SharePoint', starter: false, professional: true, enterprise: true },
      { name: 'Google Drive / Dropbox', starter: false, professional: true, enterprise: true },
      { name: 'E-signatures (DocuSign, Adobe Sign)', starter: false, professional: false, enterprise: true },
      { name: 'ERP (SAP, Coupa)', starter: false, professional: false, enterprise: true },
      { name: 'Custom integrations', starter: false, professional: false, enterprise: true },
    ],
  },
  {
    name: 'Notifications & Real-time',
    features: [
      { name: 'Email notifications', starter: true, professional: true, enterprise: true },
      { name: 'In-app notifications', starter: true, professional: true, enterprise: true },
      { name: 'Real-time WebSocket updates', starter: false, professional: true, enterprise: true },
      { name: 'Mobile push notifications', starter: false, professional: true, enterprise: true },
      { name: 'Slack / Teams integration', starter: false, professional: false, enterprise: true },
    ],
  },
  {
    name: 'Support & Onboarding',
    features: [
      { name: 'Response time SLA', starter: '48 hours', professional: '4 hours', enterprise: '1 hour' },
      { name: 'Support channels', starter: 'Email', professional: 'Email, Chat', enterprise: 'Phone, Email, Chat' },
      { name: 'Onboarding sessions', starter: '1 session', professional: '3 sessions', enterprise: 'Unlimited' },
      { name: 'Data migration assistance', starter: false, professional: true, enterprise: true },
      { name: 'Dedicated account manager', starter: false, professional: false, enterprise: true },
      { name: 'Custom training sessions', starter: false, professional: false, enterprise: true },
      { name: 'Uptime SLA', starter: '99.5%', professional: '99.9%', enterprise: 'Custom (up to 99.99%)' },
    ],
  },
];

// Pricing FAQs
const pricingFAQs = [
  {
    question: 'How is pricing determined?',
    answer: 'We offer flexible pricing tailored to your organization\'s specific needs. Pricing is based on factors including number of users, contract volume, required features, and deployment preferences. Contact us for a personalized quote.',
  },
  {
    question: 'Is there a free trial available?',
    answer: 'Yes! We offer a 14-day free trial with full access to all features. No credit card required to start. Our team will help you get set up and answer any questions during your trial.',
  },
  {
    question: 'Do you offer annual billing discounts?',
    answer: 'Yes, we offer significant discounts for annual commitments. Contact our sales team to discuss annual pricing options and the savings available for your organization.',
  },
  {
    question: 'Where is my data stored?',
    answer: 'All data is stored exclusively in Swiss data centers, ensuring compliance with Swiss data protection laws (DSG/nDSG) and GDPR. We use enterprise-grade encryption and maintain SOC 2 Type II certification.',
  },
  {
    question: 'Do you offer discounts for Swiss startups or non-profits?',
    answer: 'Yes, we offer special pricing for registered Swiss startups (via Innosuisse or similar programs) and non-profit organizations. Contact our sales team to discuss eligibility.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express), bank transfers (IBAN), and invoice payments. Enterprise customers can arrange custom payment terms. All prices are in Swiss Francs (CHF).',
  },
  {
    question: 'Can I switch plans later?',
    answer: 'Absolutely. You can upgrade or downgrade your plan at any time. Our team will work with you to ensure a smooth transition and adjust your billing accordingly.',
  },
  {
    question: 'What\'s included in the onboarding process?',
    answer: 'All plans include guided onboarding with dedicated support. Higher tier plans include additional sessions, data migration assistance, and custom training. Enterprise plans include unlimited onboarding support.',
  },
];

export default function PricingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    phone: '',
    teamSize: '',
    plan: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const scrollToForm = () => {
    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Image src="/logo.png" alt="ConTigo" width={140} height={48} className="h-10 w-auto" priority />
            </Link>
            
            <div className="hidden lg:flex items-center gap-8">
              <Link href="/#features" className="text-gray-600 hover:text-teal-600 transition-colors font-medium">Features</Link>
              <Link href="/#ai-technology" className="text-gray-600 hover:text-teal-600 transition-colors font-medium">AI Technology</Link>
              <Link href="/pricing" className="text-teal-600 font-semibold">Pricing</Link>
              <Link href="/#support" className="text-gray-600 hover:text-teal-600 transition-colors font-medium">Support</Link>
            </div>

            <div className="hidden lg:flex items-center gap-4">
              <Link href="/auth/signin" className="text-gray-700 hover:text-teal-600 transition-colors font-medium">
                Sign In
              </Link>
              <button 
                onClick={scrollToForm}
                className="bg-teal-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-teal-700 transition-all hover:shadow-lg hover:shadow-teal-600/25 flex items-center gap-2"
              >
                Get a Quote
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-100 rounded-full mb-8">
            <Globe className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-700">Swiss-Based • Swiss Data Residency • Tailored Pricing</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            Flexible Plans for<br />Every Organization
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 font-light">
            We offer customized pricing based on your specific needs. 
            Contact us for a personalized quote tailored to your organization.
          </p>

          <button
            onClick={scrollToForm}
            className="inline-flex items-center gap-3 bg-teal-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-teal-700 transition-all hover:shadow-xl hover:shadow-teal-600/25 text-lg"
          >
            Request a Quote
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Plans Overview */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Three tiers designed to scale with your business
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-3xl p-8 bg-white border-2 transition-all duration-300 hover:shadow-2xl ${
                  plan.popular 
                    ? 'border-teal-500 ring-4 ring-teal-500/20 scale-[1.02]' 
                    : 'border-gray-100 hover:border-teal-200'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg flex items-center gap-1.5">
                      <Star className="w-4 h-4" />
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Plan Icon */}
                <div className={`w-14 h-14 bg-gradient-to-br ${plan.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                  <plan.icon className="w-7 h-7 text-white" />
                </div>

                {/* Plan Header */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {plan.description}
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">{plan.idealFor}</span>
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  onClick={scrollToForm}
                  className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 mb-8 ${
                    plan.popular
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Contact for Pricing
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Features List */}
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-teal-600" />
                      </div>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Shield, label: 'Swiss Data Residency', sublabel: 'All data stored in Switzerland' },
              { icon: Lock, label: 'Bank-Grade Security', sublabel: 'AES-256 encryption' },
              { icon: Award, label: 'SOC 2 Type II', sublabel: 'Certified compliant' },
              { icon: Globe, label: 'GDPR & nDSG', sublabel: 'Fully compliant' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-7 h-7 text-teal-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.label}</h3>
                <p className="text-sm text-gray-500">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="py-24 px-6 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Left Column - Info */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-100 rounded-full mb-6">
                <Mail className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-700">Get in Touch</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Request Your<br />Custom Quote
              </h2>
              <p className="text-xl text-gray-600 mb-10">
                Tell us about your organization and we&apos;ll create a personalized pricing plan that fits your needs.
              </p>

              <div className="space-y-6">
                {[
                  { icon: Clock, title: 'Quick Response', desc: 'We\'ll get back to you within 24 hours' },
                  { icon: Users, title: 'Dedicated Support', desc: 'Personal account manager from day one' },
                  { icon: Zap, title: 'Free Trial', desc: '14-day trial with full feature access' },
                  { icon: Shield, title: 'No Commitment', desc: 'No credit card required to get started' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 p-6 bg-gray-100 rounded-2xl">
                <p className="text-gray-600 mb-4">Prefer to talk directly?</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="tel:+41445551234"
                    className="inline-flex items-center gap-2 text-teal-600 font-semibold hover:text-teal-700"
                  >
                    <Phone className="w-4 h-4" />
                    +41 44 555 12 34
                  </a>
                  <a
                    href="mailto:sales@contigo.ch"
                    className="inline-flex items-center gap-2 text-teal-600 font-semibold hover:text-teal-700"
                  >
                    <Mail className="w-4 h-4" />
                    sales@contigo.ch
                  </a>
                </div>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-teal-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Thank You!</h3>
                  <p className="text-gray-600 mb-6">
                    We&apos;ve received your request and will get back to you within 24 hours with a personalized quote.
                  </p>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-teal-600 font-semibold hover:text-teal-700"
                  >
                    Submit another request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                      <input
                        type="text"
                        required
                        value={formState.firstName}
                        onChange={(e) => setFormState({ ...formState, firstName: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={formState.lastName}
                        onChange={(e) => setFormState({ ...formState, lastName: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Email *</label>
                    <input
                      type="email"
                      required
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                      placeholder="john@company.ch"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company *</label>
                      <input
                        type="text"
                        required
                        value={formState.company}
                        onChange={(e) => setFormState({ ...formState, company: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                        placeholder="Company AG"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={formState.phone}
                        onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                        placeholder="+41 44 555 12 34"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Team Size *</label>
                      <select
                        required
                        value={formState.teamSize}
                        onChange={(e) => setFormState({ ...formState, teamSize: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all bg-white"
                      >
                        <option value="">Select size</option>
                        <option value="1-10">1-10 users</option>
                        <option value="11-50">11-50 users</option>
                        <option value="51-200">51-200 users</option>
                        <option value="200+">200+ users</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Interested Plan</label>
                      <select
                        value={formState.plan}
                        onChange={(e) => setFormState({ ...formState, plan: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all bg-white"
                      >
                        <option value="">Select plan</option>
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                        <option value="not-sure">Not sure yet</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tell us about your needs</label>
                    <textarea
                      value={formState.message}
                      onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all resize-none"
                      placeholder="How many contracts do you manage? Any specific requirements or integrations needed?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-teal-600 text-white py-4 rounded-xl font-semibold hover:bg-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Request Quote
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    By submitting this form, you agree to our{' '}
                    <Link href="/privacy" className="text-teal-600 hover:underline">Privacy Policy</Link>
                    {' '}and{' '}
                    <Link href="/terms" className="text-teal-600 hover:underline">Terms of Service</Link>.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Feature Comparison
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Compare what&apos;s included in each plan
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-hidden rounded-3xl border border-gray-200 bg-white">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-6 px-8 font-semibold text-gray-900 w-1/4">Features</th>
                  <th className="text-center py-6 px-6 font-semibold text-gray-900">Starter</th>
                  <th className="text-center py-6 px-6 font-semibold text-gray-900 bg-teal-50">
                    <span className="inline-flex items-center gap-2">
                      Professional
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">Popular</span>
                    </span>
                  </th>
                  <th className="text-center py-6 px-6 font-semibold text-gray-900">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonCategories.map((category, catIndex) => (
                  <Fragment key={`cat-${catIndex}`}>
                    <tr className="bg-gray-100">
                      <td colSpan={4} className="py-4 px-8 font-semibold text-gray-800">
                        {category.name}
                      </td>
                    </tr>
                    {category.features.map((feature, featIndex) => (
                      <tr key={`${catIndex}-${featIndex}`} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-8 text-gray-700">{feature.name}</td>
                        <td className="py-4 px-6 text-center">
                          {typeof feature.starter === 'boolean' ? (
                            feature.starter ? (
                              <Check className="w-5 h-5 text-teal-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-gray-600">{feature.starter}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center bg-teal-50/50">
                          {typeof feature.professional === 'boolean' ? (
                            feature.professional ? (
                              <Check className="w-5 h-5 text-teal-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-gray-900 font-medium">{feature.professional}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {typeof feature.enterprise === 'boolean' ? (
                            feature.enterprise ? (
                              <Check className="w-5 h-5 text-teal-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-gray-600">{feature.enterprise}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Accordion */}
          <div className="lg:hidden space-y-4">
            {comparisonCategories.map((category, catIndex) => (
              <details key={catIndex} className="bg-white rounded-2xl border border-gray-200 overflow-hidden group">
                <summary className="p-6 font-semibold text-gray-900 cursor-pointer flex items-center justify-between hover:bg-gray-50">
                  {category.name}
                  <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-6 pb-6">
                  {category.features.map((feature, featIndex) => (
                    <div key={featIndex} className="py-4 border-t border-gray-100">
                      <div className="font-medium text-gray-900 mb-3">{feature.name}</div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Starter</div>
                          {typeof feature.starter === 'boolean' ? (
                            feature.starter ? <Check className="w-4 h-4 text-teal-600 mx-auto" /> : <X className="w-4 h-4 text-gray-300 mx-auto" />
                          ) : (
                            <span className="text-gray-700">{feature.starter}</span>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Pro</div>
                          {typeof feature.professional === 'boolean' ? (
                            feature.professional ? <Check className="w-4 h-4 text-teal-600 mx-auto" /> : <X className="w-4 h-4 text-gray-300 mx-auto" />
                          ) : (
                            <span className="text-gray-900 font-medium">{feature.professional}</span>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Enterprise</div>
                          {typeof feature.enterprise === 'boolean' ? (
                            feature.enterprise ? <Check className="w-4 h-4 text-teal-600 mx-auto" /> : <X className="w-4 h-4 text-gray-300 mx-auto" />
                          ) : (
                            <span className="text-gray-700">{feature.enterprise}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 bg-teal-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-teal-700 transition-all"
            >
              Get Your Custom Quote
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Pricing FAQ */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-100 rounded-full mb-6">
              <HelpCircle className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-700">Frequently Asked Questions</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Common Questions
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about our pricing
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm">
            {pricingFAQs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === index}
                onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
              />
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">Have more questions?</p>
            <a
              href="mailto:sales@contigo.ch"
              className="inline-flex items-center gap-2 text-teal-600 font-semibold hover:text-teal-700"
            >
              <Mail className="w-4 h-4" />
              Contact our sales team
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-gradient-to-r from-teal-600 to-cyan-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Transform Your<br />Contract Management?
          </h2>
          <p className="text-xl text-teal-100 mb-10 max-w-2xl mx-auto">
            Join hundreds of Swiss companies using ConTigo. Get your personalized quote today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={scrollToForm}
              className="bg-white text-teal-700 px-10 py-5 rounded-full font-semibold hover:bg-gray-100 transition-all hover:shadow-2xl flex items-center gap-3 text-lg"
            >
              Request a Quote
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="tel:+41445551234"
              className="text-white px-10 py-5 rounded-full font-semibold border-2 border-white/30 hover:border-white hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <Phone className="w-5 h-5" />
              Call Us
            </a>
          </div>
          <p className="text-teal-200 mt-6 text-sm">
            14-day free trial • No credit card required • Swiss data residency
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
            <div className="lg:col-span-2">
              <Image src="/logo.png" alt="ConTigo" width={180} height={48} className="h-12 w-auto mb-6 brightness-0 invert" />
              <p className="text-gray-500 leading-relaxed mb-6 max-w-sm">
                Swiss-based enterprise contract management platform. Secure, intelligent, and built for compliance.
              </p>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Globe className="w-4 h-4" />
                Zürich, Switzerland
              </div>
            </div>
            
            {[
              { title: 'Product', links: [
                { label: 'Features', href: '/#features' },
                { label: 'AI Technology', href: '/#ai-technology' },
                { label: 'Security', href: '/#security' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'API', href: '/docs/api' },
              ]},
              { title: 'Resources', links: [
                { label: 'Documentation', href: '/docs' },
                { label: 'Help Center', href: '/#support' },
                { label: 'Blog', href: '/blog' },
                { label: 'Changelog', href: '/changelog' },
                { label: 'Status', href: '/status' },
              ]},
              { title: 'Company', links: [
                { label: 'About', href: '/about' },
                { label: 'Careers', href: '/careers' },
                { label: 'Contact', href: '/contact' },
                { label: 'Partners', href: '/partners' },
                { label: 'Legal', href: '/legal' },
              ]},
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white font-semibold mb-6 text-lg">{col.title}</h4>
                <ul className="space-y-4">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="hover:text-white transition-colors">{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} ConTigo AG. All rights reserved. Made in Switzerland 🇨🇭</p>
            <div className="flex items-center gap-8 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link>
              <Link href="/gdpr" className="hover:text-white transition-colors">GDPR</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
