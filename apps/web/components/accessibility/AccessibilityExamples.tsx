/**
 * Accessibility Examples
 * Demonstrates WCAG 2.1 Level AA compliant components
 */

'use client';

import React, { useState } from 'react';
import {
  SkipLinks,
  AccessibleModal,
  AccessibleButton,
  AccessibleFormField,
  AccessibleAccordion,
  AccessibleTabs,
  AccessibleCheckbox,
  ScreenReaderOnly,
  LiveRegion,
} from './AccessibleComponents';
import { useAnnouncer, usePrefersReducedMotion, usePrefersHighContrast } from '@/hooks/useAccessibility';
import { Save, Trash2, Edit } from 'lucide-react';

export function AccessibilityExamples() {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  
  const { announce } = useAnnouncer();
  const prefersReducedMotion = usePrefersReducedMotion();
  const prefersHighContrast = usePrefersHighContrast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name) {
      newErrors.name = 'Name is required';
    }
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      announce('Form submitted successfully');
      setAnnouncement('Form submitted successfully!');
      setTimeout(() => setAnnouncement(''), 3000);
    } else {
      announce('Form has errors. Please correct them and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SkipLinks />

      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold">Accessibility Examples</h1>
          <p className="text-gray-600 mt-1">
            WCAG 2.1 Level AA compliant components
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* User Preferences */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">User Preferences Detected</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${prefersReducedMotion ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Prefers Reduced Motion: {prefersReducedMotion ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${prefersHighContrast ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Prefers High Contrast: {prefersHighContrast ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Accessible Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <AccessibleButton variant="primary" icon={<Save />}>
              Save
            </AccessibleButton>
            <AccessibleButton variant="secondary" icon={<Edit />}>
              Edit
            </AccessibleButton>
            <AccessibleButton variant="danger" icon={<Trash2 />}>
              Delete
            </AccessibleButton>
            <AccessibleButton variant="primary" loading>
              Loading
            </AccessibleButton>
            <AccessibleButton variant="primary" disabled>
              Disabled
            </AccessibleButton>
            <AccessibleButton 
              variant="primary" 
              ariaLabel="Save document"
              icon={<Save />}
            >
              <ScreenReaderOnly>Save document</ScreenReaderOnly>
            </AccessibleButton>
          </div>
        </section>

        {/* Form */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Accessible Form</h2>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <AccessibleFormField
              id="name"
              label="Full Name"
              required
              error={errors.name}
              hint="Enter your first and last name"
            >
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="email"
              label="Email Address"
              required
              error={errors.email}
              hint="We'll never share your email"
            >
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </AccessibleFormField>

            <AccessibleCheckbox
              id="terms"
              label="I agree to the terms and conditions"
              checked={checked}
              onChange={setChecked}
              description="You must agree to continue"
            />

            <AccessibleButton type="submit" variant="primary">
              Submit Form
            </AccessibleButton>
          </form>

          {announcement && <LiveRegion message={announcement} />}
        </section>

        {/* Modal */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Accessible Modal</h2>
          <AccessibleButton onClick={() => setModalOpen(true)}>
            Open Modal
          </AccessibleButton>

          <AccessibleModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Example Modal"
            description="This is an accessible modal dialog with focus trap and keyboard navigation"
          >
            <div className="space-y-4">
              <p>
                This modal demonstrates proper accessibility features:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Focus trap keeps keyboard navigation within the modal</li>
                <li>Escape key closes the modal</li>
                <li>Proper ARIA attributes for screen readers</li>
                <li>Backdrop click closes the modal</li>
                <li>Respects reduced motion preferences</li>
              </ul>
              <div className="flex gap-3 justify-end">
                <AccessibleButton variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </AccessibleButton>
                <AccessibleButton variant="primary" onClick={() => setModalOpen(false)}>
                  Confirm
                </AccessibleButton>
              </div>
            </div>
          </AccessibleModal>
        </section>

        {/* Accordion */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Accessible Accordion</h2>
          <AccessibleAccordion
            items={[
              {
                id: '1',
                title: 'What is accessibility?',
                defaultOpen: true,
                children: (
                  <p className="text-gray-700">
                    Accessibility ensures that people with disabilities can perceive, understand, 
                    navigate, and interact with websites and tools.
                  </p>
                ),
              },
              {
                id: '2',
                title: 'Why is WCAG important?',
                children: (
                  <p className="text-gray-700">
                    WCAG (Web Content Accessibility Guidelines) provides a standard for making 
                    web content more accessible to people with disabilities.
                  </p>
                ),
              },
              {
                id: '3',
                title: 'What is Level AA compliance?',
                children: (
                  <p className="text-gray-700">
                    Level AA is the recommended level of conformance, addressing the biggest 
                    and most common barriers for disabled users.
                  </p>
                ),
              },
            ]}
          />
        </section>

        {/* Tabs */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Accessible Tabs</h2>
          <AccessibleTabs
            tabs={[
              {
                id: 'overview',
                label: 'Overview',
                content: (
                  <div>
                    <h3 className="font-semibold mb-2">Overview</h3>
                    <p className="text-gray-700">
                      These tabs support keyboard navigation with arrow keys, Home, and End keys.
                    </p>
                  </div>
                ),
              },
              {
                id: 'features',
                label: 'Features',
                content: (
                  <div>
                    <h3 className="font-semibold mb-2">Features</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      <li>Keyboard navigation</li>
                      <li>Proper ARIA roles and attributes</li>
                      <li>Focus management</li>
                      <li>Screen reader support</li>
                    </ul>
                  </div>
                ),
              },
              {
                id: 'usage',
                label: 'Usage',
                content: (
                  <div>
                    <h3 className="font-semibold mb-2">Usage</h3>
                    <p className="text-gray-700">
                      Use arrow keys to navigate between tabs, or click with a mouse.
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </section>

        {/* Keyboard Navigation Guide */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Keyboard Navigation</h2>
          <div className="space-y-3">
            <KeyboardShortcut keys={['Tab']} description="Move focus forward" />
            <KeyboardShortcut keys={['Shift', 'Tab']} description="Move focus backward" />
            <KeyboardShortcut keys={['Enter', 'Space']} description="Activate button or link" />
            <KeyboardShortcut keys={['Escape']} description="Close modal or cancel" />
            <KeyboardShortcut keys={['Arrow Keys']} description="Navigate within components" />
            <KeyboardShortcut keys={['Home']} description="Jump to first item" />
            <KeyboardShortcut keys={['End']} description="Jump to last item" />
          </div>
        </section>
      </main>
    </div>
  );
}

function KeyboardShortcut({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-700">{description}</span>
      <div className="flex gap-1">
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="text-gray-400 mx-1">+</span>}
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">
              {key}
            </kbd>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
