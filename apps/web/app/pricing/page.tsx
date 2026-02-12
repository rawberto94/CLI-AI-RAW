'use client';

import Link from 'next/link';
import { Check, ArrowRight, ArrowLeft, Sparkles, HelpCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900">{question}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-6 text-gray-600 leading-relaxed">{answer}</div>
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
            <span className="text-xl font-bold">
              <span className="text-violet-600">con</span>
              <span className="text-gray-900">tigo</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signin"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-full hover:shadow-lg hover:shadow-violet-500/25 transition-all"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 text-violet-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
            <Sparkles className="w-4 h-4" />
            Pricing
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            Simple, Transparent{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">
              Pricing
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto font-light leading-relaxed">
            Two plans to fit your needs. Contact us for exact pricing tailored to your organization.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Standard */}
          <div className="bg-white rounded-3xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-300">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Standard</h2>
              <p className="text-gray-500">
                For teams getting started with AI contract management
              </p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-bold text-gray-900">Custom</span>
              <span className="text-gray-500 ml-2">pricing</span>
            </div>
            <ul className="space-y-4 mb-8">
              {[
                'AI-powered contract analysis',
                'Key data extraction (parties, dates, values)',
                'Document OCR & parsing (PDF, Word, images)',
                'Semantic search across contracts',
                'Dashboard & reporting',
                'Team collaboration & comments',
                'Notifications & renewal alerts',
                'Secure cloud storage',
                'Email support',
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-700">
                  <Check className="w-5 h-5 text-violet-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="mailto:sales@contigo.com?subject=Standard%20Plan%20Inquiry"
              className="block w-full text-center py-4 rounded-xl border-2 border-violet-200 text-violet-700 font-semibold hover:bg-violet-50 transition-colors"
            >
              Contact Sales
            </Link>
          </div>

          {/* Pro */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-purple-500 rounded-[1.5rem] opacity-20 blur-xl group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-white rounded-3xl border-2 border-violet-300 p-8 hover:shadow-xl transition-all duration-300">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg">
                  Most Popular
                </span>
              </div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Pro</h2>
                <p className="text-gray-500">
                  For organizations that need the full platform
                </p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-bold text-gray-900">Custom</span>
                <span className="text-gray-500 ml-2">pricing</span>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  'Everything in Standard',
                  'Workflow automation & approvals',
                  'Advanced analytics & forecasting',
                  'Rate card management & benchmarking',
                  'Vendor risk & supplier management',
                  'Governance & compliance tools',
                  'Webhooks & third-party integrations',
                  'SSO (SAML 2.0) & MFA',
                  'REST API access',
                  'Priority support & onboarding',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-violet-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="mailto:sales@contigo.com?subject=Pro%20Plan%20Inquiry"
                className="block w-full text-center py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-500 mt-10 text-sm max-w-2xl mx-auto">
          Need a custom solution?{' '}
          <a href="mailto:sales@contigo.com" className="text-violet-600 hover:underline font-medium">
            Get in touch
          </a>{' '}
          — we&apos;ll tailor a plan for your organization.
        </p>
      </section>

      {/* Feature Comparison */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-10">
            Feature Comparison
          </h3>
          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-6 text-gray-500 font-medium">Feature</th>
                  <th className="p-6 text-center font-bold text-gray-900">Standard</th>
                  <th className="p-6 text-center font-bold text-gray-900 bg-violet-50/50">Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'AI Contract Analysis', standard: true, pro: true },
                  { feature: 'Data Extraction', standard: true, pro: true },
                  { feature: 'OCR & Document Parsing', standard: true, pro: true },
                  { feature: 'Semantic Search', standard: true, pro: true },
                  { feature: 'Dashboard & Reporting', standard: true, pro: true },
                  { feature: 'Team Collaboration & Comments', standard: true, pro: true },
                  { feature: 'Notifications & Renewal Alerts', standard: true, pro: true },
                  { feature: 'Cloud Storage', standard: true, pro: true },
                  { feature: 'Workflow Automation & Approvals', standard: false, pro: true },
                  { feature: 'Advanced Analytics & Forecasting', standard: false, pro: true },
                  { feature: 'Rate Card Management', standard: false, pro: true },
                  { feature: 'Vendor Risk & Supplier Mgmt', standard: false, pro: true },
                  { feature: 'Governance & Compliance', standard: false, pro: true },
                  { feature: 'Webhooks & Integrations', standard: false, pro: true },
                  { feature: 'SSO (SAML 2.0) & MFA', standard: false, pro: true },
                  { feature: 'REST API Access', standard: false, pro: true },
                  { feature: 'Priority Support', standard: false, pro: true },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="p-5 text-gray-700 font-medium">{row.feature}</td>
                    <td className="p-5 text-center">
                      {row.standard ? (
                        <Check className="w-5 h-5 text-violet-500 mx-auto" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="p-5 text-center bg-violet-50/50">
                      {row.pro ? (
                        <Check className="w-5 h-5 text-violet-500 mx-auto" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing FAQ */}
      <section className="pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-gray-500 mb-4">
              <HelpCircle className="w-5 h-5" />
              <span className="font-medium">Questions about pricing?</span>
            </div>
          </div>
          <div className="space-y-3">
            <FAQItem
              question="How is pricing determined?"
              answer="Pricing is based on your team size and contract volume. Contact our sales team for a quote tailored to your organization's needs."
            />
            <FAQItem
              question="Can I switch plans later?"
              answer="Yes. You can upgrade from Standard to Pro at any time. Our team will help migrate your configuration seamlessly."
            />
            <FAQItem
              question="Is there a free trial?"
              answer="We offer a guided demo and pilot period so you can evaluate ConTigo with your own contracts before committing."
            />
            <FAQItem
              question="What kind of support is included?"
              answer="Standard includes email support. Pro adds priority support with faster response times and dedicated onboarding assistance."
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl p-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-violet-200 mb-8 text-lg max-w-xl mx-auto">
              Join teams already using ConTigo to manage contracts smarter.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/signin"
                className="flex items-center gap-2 px-8 py-4 bg-white text-violet-700 font-semibold rounded-full hover:shadow-xl transition-all"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="mailto:sales@contigo.com"
                className="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-full hover:bg-white/10 transition-all"
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} ConTigo. All rights reserved.
          </p>
          <Link href="/" className="text-violet-600 text-sm hover:underline font-medium">
            ← Back to Home
          </Link>
        </div>
      </footer>
    </div>
  );
}
