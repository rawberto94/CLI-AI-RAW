import { 
  FileText, 
  ArrowRight,
  Scale,
  AlertTriangle,
  CreditCard,
  Ban,
  FileCheck,
  Gavel
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service - ConTigo',
  description: 'Read the terms and conditions for using the ConTigo contract intelligence platform.',
};

const sections = [
  {
    icon: FileCheck,
    title: '1. Acceptance of Terms',
    content: `By accessing or using ConTigo's contract intelligence platform ("Service"), you agree to be bound by these Terms of Service. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these terms.

These terms apply to all users, including visitors, registered users, and paying customers. We may update these terms from time to time, and continued use of the Service constitutes acceptance of any changes.`,
  },
  {
    icon: Scale,
    title: '2. Service Description',
    content: `ConTigo provides an AI-powered contract intelligence platform that allows you to:
    
• Upload and store contract documents
• Extract key terms, dates, and obligations using AI
• Search and analyze your contract portfolio
• Receive alerts for deadlines and renewals
• Collaborate with team members on contract reviews

We reserve the right to modify, suspend, or discontinue any part of the Service with reasonable notice. We are not liable for any modification, suspension, or discontinuation of the Service.`,
  },
  {
    icon: CreditCard,
    title: '3. Billing & Payments',
    content: `Paid subscriptions are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law or as explicitly stated in these terms.

• Prices may change with 30 days notice
• Failed payments may result in service suspension
• You are responsible for all applicable taxes
• Annual subscriptions may be cancelled for a prorated refund within the first 30 days
• Free trials automatically convert to paid subscriptions unless cancelled`,
  },
  {
    icon: AlertTriangle,
    title: '4. Acceptable Use',
    content: `You agree not to use the Service to:

• Upload content that you don't have the right to share
• Violate any applicable laws or regulations
• Attempt to gain unauthorized access to systems or data
• Interfere with or disrupt the Service's operation
• Use automated means to access the Service without permission
• Reverse engineer or attempt to extract source code
• Share your account credentials with unauthorized users
• Upload malicious content or attempt to compromise security`,
  },
  {
    icon: FileText,
    title: '5. Intellectual Property',
    content: `Your Content: You retain all rights to the contracts and documents you upload. By using the Service, you grant us a limited license to process your content for providing the Service.

Our Content: The Service, including its design, features, and underlying technology, is owned by ConTigo and protected by intellectual property laws. You may not copy, modify, or create derivative works without permission.

AI Training: We do not use your contract content to train public AI models. Your data remains confidential and is only processed to provide you with the Service.`,
  },
  {
    icon: Ban,
    title: '6. Limitation of Liability',
    content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW:

• The Service is provided "as is" without warranties of any kind
• We are not liable for any indirect, incidental, or consequential damages
• Our total liability is limited to the fees paid in the 12 months preceding the claim
• We are not responsible for any loss of data, profits, or business opportunities
• We do not guarantee that AI-generated insights are 100% accurate

You are responsible for maintaining your own backups and verifying critical information extracted by our AI systems.`,
  },
  {
    icon: Gavel,
    title: '7. Dispute Resolution',
    content: `These terms are governed by the laws of Switzerland. Any disputes shall be resolved through:

1. Good faith negotiation between the parties
2. Mediation under ICC rules if negotiation fails
3. Binding arbitration in Zurich, Switzerland

For EU consumers, this does not affect your statutory rights under applicable consumer protection laws. You may also have the right to bring claims in your local courts.`,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="group flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                ConTigo
              </span>
            </Link>
            
            <Link
              href="/auth/signin"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-105"
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
          <div className="absolute top-1/4 -right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 mb-8">
              <Scale className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Legal Agreement</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-bold text-white">
              Terms of Service
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
              Welcome to ConTigo. These Terms of Service govern your access to and use of our 
              contract intelligence platform. Please read these terms carefully before using 
              our Service. By using ConTigo, you agree to these terms in their entirety.
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
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <section.icon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">{section.title}</h2>
              </div>
              <div className="text-slate-300 leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-white/10 rounded-2xl p-8 text-center">
            <Scale className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Questions About Our Terms?</h2>
            <p className="text-slate-300 mb-6">
              Contact our legal team at{' '}
              <a href="mailto:legal@contigo.io" className="text-purple-400 hover:text-purple-300">
                legal@contigo.io
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white">ConTigo</span>
            </Link>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="text-white">Terms</Link>
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
