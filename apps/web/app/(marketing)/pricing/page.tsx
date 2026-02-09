'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
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
  HelpCircle,
  ChevronRight,
  Users,
  Zap,
  Send,
  Loader2,
  CheckCircle2,
  Briefcase,
  Building,
  Rocket,
  Layers
} from 'lucide-react';

// FAQ Item Component
function FAQItem({ question, answer, isOpen, onClick, index }: { question: string; answer: string; isOpen: boolean; onClick: () => void; index: number }) {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        id={`pricing-faq-button-${index}`}
        onClick={onClick}
        aria-expanded={isOpen}
        aria-controls={`pricing-faq-panel-${index}`}
        className="w-full py-6 flex items-center justify-between text-left hover:text-violet-600 transition-colors group"
      >
        <span className="text-lg font-semibold text-gray-900 group-hover:text-violet-600 pr-8">{question}</span>
        <div className={`w-8 h-8 rounded-full bg-gray-100 group-hover:bg-violet-100 flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-violet-100 rotate-180' : ''}`}>
          <ChevronDown className={`w-5 h-5 text-gray-500 group-hover:text-violet-600 transition-all duration-300 ${isOpen ? 'text-violet-600' : ''}`} aria-hidden="true" />
        </div>
      </button>
      <div
        id={`pricing-faq-panel-${index}`}
        role="region"
        aria-labelledby={`pricing-faq-button-${index}`}
        className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] pb-6' : 'grid-rows-[0fr]'}`}
      >
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
    gradient: 'from-violet-500 to-purple-500',
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
    gradient: 'from-violet-500 to-purple-500',
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
    gradient: 'from-violet-500 to-purple-500',
    idealFor: 'Large organizations (50+ users)',
    features: [
      'Unlimited users & contracts',
      'Custom AI model fine-tuning',
      'Multi-tenant workspace isolation',
      'Advanced workflow automation with escalations',
      'E-signature integrations',
      'Full ERP integration support',
      'Knowledge graph & entity relationships',
      'AI contract generation & drafting',
      'Negotiation assistant with market intelligence',
      'Custom reporting & BI export',
      'SSO/SAML + SCIM user provisioning',
      'Unlimited audit log retention',
      'Dedicated account manager',
      'On-premise / private cloud deployment',
      'Compliance-ready architecture (FINMA, ISO 27001, SOC 2)',
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
      { name: 'SOC 2 Type II readiness', starter: false, professional: true, enterprise: true },
      { name: 'FINMA compliance-ready', starter: false, professional: false, enterprise: true },
      { name: 'ISO 27001 readiness', starter: false, professional: false, enterprise: true },
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
      { name: 'E-signature integrations', starter: false, professional: false, enterprise: true },
      { name: 'ERP integrations', starter: false, professional: false, enterprise: true },
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
    question: 'Can I see a demo before purchasing?',
    answer: 'Absolutely! We offer personalized demos tailored to your specific needs. Our team will walk you through the platform, answer your questions, and help you understand how ConTigo can benefit your organization.',
  },
  {
    question: 'Do you offer annual billing discounts?',
    answer: 'Yes, we offer significant discounts for annual commitments. Contact our sales team to discuss annual pricing options and the savings available for your organization.',
  },
  {
    question: 'Where is my data stored?',
    answer: 'All data is stored exclusively in Swiss data centers, ensuring compliance with Swiss data protection laws (DSG/nDSG) and GDPR. We use enterprise-grade encryption and our architecture is designed to support SOC 2 Type II requirements.',
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
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formState, source: 'pricing-quote' }),
      });
      if (response.ok) {
        setIsSubmitted(true);
      }
    } catch {
      // Silently handle — form shows success on submit
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 bg-gradient-to-b from-gray-50 via-white to-white relative overflow-hidden">
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-violet-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-40 right-1/4 w-[500px] h-[500px] bg-violet-200/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 rounded-full mb-8 shadow-sm">
            <Globe className="w-4 h-4 text-violet-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-violet-700">Swiss-Based • Swiss Data Residency • Tailored Pricing</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 mb-8 tracking-tight leading-tight">
            Flexible Plans for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-violet-500 to-purple-500">Every Organization</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
            We offer customized pricing based on your specific needs. 
            Contact us for a personalized quote tailored to your organization.
          </p>

          <button
            onClick={scrollToForm}
            className="group inline-flex items-center gap-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-10 py-5 rounded-full font-semibold hover:shadow-xl hover:shadow-violet-500/25 transition-all text-lg"
          >
            Request a Quote
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
                className={`relative rounded-3xl p-8 bg-white border-2 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 ${
                  plan.popular 
                    ? 'border-violet-500 ring-4 ring-violet-500/20 scale-[1.02] shadow-lg shadow-violet-500/10' 
                    : 'border-gray-100 hover:border-violet-200'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg shadow-violet-500/30 flex items-center gap-2">
                      <Star className="w-4 h-4" aria-hidden="true" />
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="relative inline-block mb-6">
                  <div className={`absolute inset-0 bg-gradient-to-br ${plan.gradient} rounded-2xl blur-xl opacity-40`} />
                  <div className={`relative w-16 h-16 bg-gradient-to-br ${plan.gradient} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <plan.icon className="w-8 h-8 text-white" aria-hidden="true" />
                  </div>
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
                    <Users className="w-4 h-4 text-gray-500" aria-hidden="true" />
                    <span className="text-sm text-gray-600">{plan.idealFor}</span>
                  </div>
                </div>

                <button
                  onClick={scrollToForm}
                  className={`group w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 mb-8 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:shadow-violet-500/25'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Contact for Pricing
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 group">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center flex-shrink-0 mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity`}>
                        <Check className="w-3 h-3 text-white" aria-hidden="true" />
                      </div>
                      <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-20 px-6 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #8B5CF6 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="max-w-5xl mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Shield, label: 'Swiss Data Residency', sublabel: 'All data stored in Switzerland', gradient: 'from-violet-500 to-purple-500' },
              { icon: Lock, label: 'Bank-Grade Security', sublabel: 'AES-256 encryption', gradient: 'from-violet-500 to-purple-500' },
              { icon: Award, label: 'Compliance-Ready', sublabel: 'SOC 2 & ISO architecture', gradient: 'from-violet-500 to-purple-500' },
              { icon: Globe, label: 'GDPR & nDSG', sublabel: 'Fully compliant', gradient: 'from-orange-500 to-amber-500' },
            ].map((item, i) => (
              <div key={i} className="text-center group">
                <div className="relative inline-block mb-4">
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity`} />
                  <div className={`relative w-16 h-16 bg-gradient-to-br ${item.gradient} rounded-2xl shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className="w-8 h-8 text-white" aria-hidden="true" />
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{item.label}</h3>
                <p className="text-sm text-gray-500">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="py-32 px-6 bg-gradient-to-b from-white via-violet-50/30 to-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-violet-200/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-violet-200/20 to-transparent rounded-full blur-3xl" />
        <div className="max-w-5xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Left Column - Info */}
            <div>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 rounded-full mb-6 shadow-sm">
                <Mail className="w-4 h-4 text-violet-600" aria-hidden="true" />
                <span className="text-sm font-semibold text-violet-700">Get in Touch</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Request Your{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">Custom Quote</span>
              </h2>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                Tell us about your organization and we&apos;ll create a personalized pricing plan that fits your needs.
              </p>

              <div className="space-y-5">
                {[
                  { icon: Clock, title: 'Quick Response', desc: 'We\'ll get back to you within 24 hours', gradient: 'from-violet-500 to-purple-500' },
                  { icon: Users, title: 'Dedicated Support', desc: 'Personal account manager from day one', gradient: 'from-violet-500 to-purple-500' },
                  { icon: Zap, title: 'Personalized Demo', desc: 'See the platform tailored to your needs', gradient: 'from-violet-500 to-purple-500' },
                  { icon: Shield, title: 'Flexible Terms', desc: 'Plans customized for your business', gradient: 'from-orange-500 to-amber-500' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="relative">
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} rounded-xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity`} />
                      <div className={`relative w-12 h-12 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <item.icon className="w-6 h-6 text-white" aria-hidden="true" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 p-6 bg-gray-100 rounded-2xl">
                <p className="text-gray-600 mb-4">Prefer to talk directly?</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="mailto:sales@contigo.ch"
                    className="inline-flex items-center gap-2 text-violet-600 font-semibold hover:text-violet-700"
                  >
                    <Phone className="w-4 h-4" />
                    Contact Sales
                  </a>
                  <a
                    href="mailto:sales@contigo.ch"
                    className="inline-flex items-center gap-2 text-violet-600 font-semibold hover:text-violet-700"
                  >
                    <Mail className="w-4 h-4" />
                    sales@contigo.ch
                  </a>
                </div>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-br from-violet-500/20 via-violet-500/10 to-violet-500/20 rounded-[2rem] blur-xl" />
              <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-gray-100/50">
              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-violet-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Thank You!</h3>
                  <p className="text-gray-600 mb-6">
                    We&apos;ve received your request and will get back to you within 24 hours with a personalized quote.
                  </p>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-violet-600 font-semibold hover:text-violet-700"
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
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
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                        placeholder="Company AG"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={formState.phone}
                        onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                        placeholder="+41 XX XXX XX XX"
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all bg-white"
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all bg-white"
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
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all resize-none"
                      placeholder="How many contracts do you manage? Any specific requirements or integrations needed?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full relative group overflow-hidden bg-gradient-to-r from-violet-600 to-purple-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:shadow-violet-500/25 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative flex items-center gap-2">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" aria-hidden="true" />
                        Request Quote
                      </>
                    )}
                    </span>
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    By submitting this form, you agree to our{' '}
                    <Link href="/privacy" className="text-violet-600 hover:underline">Privacy Policy</Link>
                    {' '}and{' '}
                    <Link href="/terms" className="text-violet-600 hover:underline">Terms of Service</Link>.
                  </p>
                </form>
              )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-32 px-6 bg-gradient-to-b from-gray-50 via-white to-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #8B5CF6 1px, transparent 0)', backgroundSize: '48px 48px' }} />
        <div className="absolute top-40 left-0 w-[800px] h-[800px] bg-gradient-to-r from-violet-100/30 to-transparent rounded-full blur-3xl" />
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-200/50 rounded-full mb-6 shadow-sm">
              <Layers className="w-4 h-4 text-gray-600" aria-hidden="true" />
              <span className="text-sm font-semibold text-gray-700">Detailed Comparison</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900">Feature</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">Comparison</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Compare what&apos;s included in each plan
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-hidden rounded-3xl border border-gray-200/50 bg-white/80 backdrop-blur-sm shadow-xl">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-6 px-8 font-semibold text-gray-900 w-1/4">Features</th>
                  <th className="text-center py-6 px-6 font-semibold text-gray-900">Starter</th>
                  <th className="text-center py-6 px-6 font-semibold text-gray-900 bg-violet-50">
                    <span className="inline-flex items-center gap-2">
                      Professional
                      <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full">Popular</span>
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
                              <Check className="w-5 h-5 text-violet-600 mx-auto" aria-hidden="true" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" aria-hidden="true" />
                            )
                          ) : (
                            <span className="text-gray-600">{feature.starter}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center bg-violet-50/50">
                          {typeof feature.professional === 'boolean' ? (
                            feature.professional ? (
                              <Check className="w-5 h-5 text-violet-600 mx-auto" aria-hidden="true" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" aria-hidden="true" />
                            )
                          ) : (
                            <span className="text-gray-900 font-medium">{feature.professional}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {typeof feature.enterprise === 'boolean' ? (
                            feature.enterprise ? (
                              <Check className="w-5 h-5 text-violet-600 mx-auto" aria-hidden="true" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" aria-hidden="true" />
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
              <details key={catIndex} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 overflow-hidden group shadow-lg">
                <summary className="p-6 font-bold text-gray-900 cursor-pointer flex items-center justify-between hover:bg-gray-50/50">
                  {category.name}
                  <ChevronRight className="w-5 h-5 text-violet-600 group-open:rotate-90 transition-transform" aria-hidden="true" />
                </summary>
                <div className="px-6 pb-6">
                  {category.features.map((feature, featIndex) => (
                    <div key={featIndex} className="py-4 border-t border-gray-100">
                      <div className="font-medium text-gray-900 mb-3">{feature.name}</div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Starter</div>
                          {typeof feature.starter === 'boolean' ? (
                            feature.starter ? <Check className="w-4 h-4 text-violet-600 mx-auto" aria-hidden="true" /> : <X className="w-4 h-4 text-gray-300 mx-auto" aria-hidden="true" />
                          ) : (
                            <span className="text-gray-700">{feature.starter}</span>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Pro</div>
                          {typeof feature.professional === 'boolean' ? (
                            feature.professional ? <Check className="w-4 h-4 text-violet-600 mx-auto" aria-hidden="true" /> : <X className="w-4 h-4 text-gray-300 mx-auto" aria-hidden="true" />
                          ) : (
                            <span className="text-gray-900 font-medium">{feature.professional}</span>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Enterprise</div>
                          {typeof feature.enterprise === 'boolean' ? (
                            feature.enterprise ? <Check className="w-4 h-4 text-violet-600 mx-auto" aria-hidden="true" /> : <X className="w-4 h-4 text-gray-300 mx-auto" aria-hidden="true" />
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
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-4 rounded-full font-bold hover:shadow-xl hover:shadow-violet-500/25 hover:-translate-y-0.5 transition-all"
            >
              Get Your Custom Quote
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Pricing FAQ */}
      <section className="py-32 px-6 bg-gradient-to-b from-white via-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #8B5CF6 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-violet-100/30 to-transparent rounded-full blur-3xl" />
        <div className="max-w-4xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 rounded-full mb-6 shadow-sm">
              <HelpCircle className="w-4 h-4 text-violet-600" aria-hidden="true" />
              <span className="text-sm font-semibold text-violet-700">Frequently Asked Questions</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Common{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">Questions</span>
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about our pricing
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-br from-violet-500/10 via-transparent to-violet-500/10 rounded-[2rem] blur-xl" />
            <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-100/50">
            {pricingFAQs.map((faq, index) => (
              <FAQItem
                key={index}
                index={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === index}
                onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
              />
            ))}
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">Have more questions?</p>
            <a
              href="mailto:sales@contigo.ch"
              className="inline-flex items-center gap-2 text-violet-600 font-bold hover:text-violet-700 group"
            >
              <Mail className="w-4 h-4" />
              Contact our sales team
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 bg-gradient-to-br from-violet-600 via-violet-600 to-purple-600 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            Ready to Transform Your<br />Contract Management?
          </h2>
          <p className="text-xl text-violet-100 mb-10 max-w-2xl mx-auto">
            Join Swiss enterprises transforming their contract management. Get your personalized quote today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={scrollToForm}
              className="group bg-white text-violet-700 px-10 py-5 rounded-full font-bold hover:bg-gray-50 transition-all hover:shadow-2xl hover:shadow-black/20 flex items-center gap-3 text-lg hover:-translate-y-1"
            >
              Request a Quote
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="mailto:sales@contigo.ch"
              className="text-white px-10 py-5 rounded-full font-bold border-2 border-white/30 hover:border-white hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <Phone className="w-5 h-5" />
              Contact Sales
            </a>
          </div>
          <p className="text-violet-200 mt-8 text-sm">
            Personalized demo available • Swiss data residency • Enterprise-grade security
          </p>
        </div>
      </section>

    </div>
  );
}
