'use client';

import { useState } from 'react';
import {
  Sparkles,
  Mail,
  MessageSquare,
  MapPin,
  Clock,
  Send,
  CheckCircle,
  Building2,
  AlertCircle,
} from 'lucide-react';

const contactReasons = [
  { value: 'sales', label: 'Sales Inquiry' },
  { value: 'support', label: 'Technical Support' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Other' },
];

export default function ContactForm() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    company: '',
    reason: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        setError('Failed to send message. Please try again or email us directly.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="relative pt-16 pb-16 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 mb-8">
              <Sparkles className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <span className="text-sm font-medium text-violet-300">Get in Touch</span>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold">
              <span className="text-white">We&apos;d Love to</span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Hear From You
              </span>
            </h1>
            <p className="mt-6 text-xl text-slate-400 max-w-2xl mx-auto">
              Have questions about ConTigo? Our team is here to help.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Grid */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Cards */}
            <div className="space-y-6">
              <a
                href="mailto:hello@contigo.io"
                className="group block bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 hover:border-white/10 transition-all"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg transition-transform group-hover:scale-110">
                  <Mail className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Email Us</h3>
                <p className="text-slate-400 mb-3">Our team typically responds within 24 hours.</p>
                <span className="text-violet-400 font-medium group-hover:text-violet-300 transition-colors">
                  hello@contigo.io
                </span>
              </a>

              <div className="group bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 hover:border-white/10 transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg transition-transform group-hover:scale-110">
                  <MessageSquare className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Live Chat</h3>
                <p className="text-slate-400 mb-3">Available Monday to Friday, 9am-6pm CET.</p>
                <span className="text-violet-400 font-medium">Start a conversation</span>
              </div>

              <a
                href="mailto:sales@contigo.io?subject=Demo%20Request"
                className="group block bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 hover:border-white/10 transition-all"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-4 shadow-lg transition-transform group-hover:scale-110">
                  <Building2 className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Sales</h3>
                <p className="text-slate-400 mb-3">Get a personalized demo for your team.</p>
                <span className="text-violet-400 font-medium group-hover:text-violet-300 transition-colors">
                  Schedule a call
                </span>
              </a>

              {/* Office Info */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Our Office</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-violet-400 mt-0.5" aria-hidden="true" />
                    <div className="text-slate-400">
                      <p>Zürich, Switzerland</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-violet-400" aria-hidden="true" />
                    <span className="text-slate-400">Mon-Fri: 9:00 - 18:00 CET</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-8">
                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-8 h-8 text-white" aria-hidden="true" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
                    <p className="text-slate-400 mb-6">
                      Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                    </p>
                    <button
                      onClick={() => {
                        setIsSubmitted(false);
                        setError(null);
                        setFormState({ name: '', email: '', company: '', reason: '', message: '' });
                      }}
                      className="text-violet-400 font-medium hover:text-violet-300 transition-colors"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                      <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                        <p>{error}</p>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                          Full Name *
                        </label>
                        <input
                          id="name"
                          type="text"
                          required
                          value={formState.name}
                          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                          Email Address *
                        </label>
                        <input
                          id="email"
                          type="email"
                          required
                          value={formState.email}
                          onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                          placeholder="john@company.com"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="company" className="block text-sm font-medium text-slate-300 mb-2">
                          Company
                        </label>
                        <input
                          id="company"
                          type="text"
                          value={formState.company}
                          onChange={(e) => setFormState({ ...formState, company: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                          placeholder="Acme Inc."
                        />
                      </div>
                      <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-slate-300 mb-2">
                          Reason for Contact
                        </label>
                        <select
                          id="reason"
                          value={formState.reason}
                          onChange={(e) => setFormState({ ...formState, reason: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                        >
                          <option value="" className="bg-slate-900">Select a reason</option>
                          {contactReasons.map((reason) => (
                            <option key={reason.value} value={reason.value} className="bg-slate-900">
                              {reason.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
                        Message *
                      </label>
                      <textarea
                        id="message"
                        required
                        rows={5}
                        value={formState.message}
                        onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
                        placeholder="How can we help you?"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Message
                          <Send className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
