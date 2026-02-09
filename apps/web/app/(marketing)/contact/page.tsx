import type { Metadata } from 'next';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact - ConTigo',
  description: 'Get in touch with the ConTigo team. Sales inquiries, technical support, and partnerships.',
};

export default function ContactPage() {
  return (
    <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <ContactForm />
    </div>
  );
}
