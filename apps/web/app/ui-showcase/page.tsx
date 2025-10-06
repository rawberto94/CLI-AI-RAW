/**
 * UI Components Showcase
 * Demo page showing all new UI components
 */

'use client';

import { useState } from 'react';
import {
  AnimatedButton,
  AnimatedCard,
  CardGrid,
  FormField,
  AnimatedTable,
  ProgressBar,
  Spinner,
  SkeletonLoader,
  StageIndicator,
  SuccessCheckmark,
  Confetti,
  CountUp,
  SuccessCard,
  useToast,
} from '@/components/ui';
import { Upload, Download, Eye, Trash2 } from 'lucide-react';

export default function UIShowcasePage() {
  const { success, error, info, warning } = useToast();
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [progress, setProgress] = useState(0);

  const stages = [
    { id: '1', label: 'Upload', status: 'complete' as const },
    { id: '2', label: 'Validate', status: 'active' as const },
    { id: '3', label: 'Import', status: 'pending' as const },
  ];

  const tableData = [
    { id: '1', name: 'Acme Corp', rate: 150, status: 'Active' },
    { id: '2', name: 'TechCo', rate: 175, status: 'Active' },
    { id: '3', name: 'GlobalSoft', rate: 200, status: 'Pending' },
  ];

  const tableColumns = [
    { key: 'name', label: 'Supplier', sortable: true },
    { key: 'rate', label: 'Rate ($/hr)', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <div className="flex gap-2">
          <AnimatedButton size="sm" variant="outline">
            <Eye className="w-4 h-4" />
          </AnimatedButton>
          <AnimatedButton size="sm" variant="outline">
            <Trash2 className="w-4 h-4" />
          </AnimatedButton>
        </div>
      ),
    },
  ];

  const handleSimulateUpload = () => {
    setLoading(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setLoading(false);
          setShowSuccess(true);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Confetti active={showConfetti} />
      
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            UI Components Showcase
          </h1>
          <p className="text-gray-600">
            All new components ready to use in your application
          </p>
        </div>

        {/* Toast Notifications */}
        <section className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-2xl font-bold mb-4">Toast Notifications</h2>
          <div className="flex flex-wrap gap-3">
            <AnimatedButton
              variant="primary"
              onClick={() => success('Success!', 'Operation completed successfully')}
            >
              Show Success
            </AnimatedButton>
            <AnimatedButton
              variant="danger"
              onClick={() => error('Error!', 'Something went wrong')}
            >
              Show Error
            </AnimatedButton>
            <AnimatedButton
              variant="secondary"
              onClick={() => info('Info', 'Here is some information')}
            >
              Show Info
            </AnimatedButton>
            <AnimatedButton
              variant="outline"
              onClick={() => warning('Warning', 'Please be careful')}
            >
              Show Warning
            </AnimatedButton>
          </div>
        </section>

        {/* Buttons */}
        <section className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-2xl font-bold mb-4">Animated Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <AnimatedButton variant="primary">Primary</AnimatedButton>
            <AnimatedButton variant="secondary">Secondary</AnimatedButton>
            <AnimatedButton variant="outline">Outline</AnimatedButton>
            <AnimatedButton variant="ghost">Ghost</AnimatedButton>
            <AnimatedButton variant="danger">Danger</AnimatedButton>
            <AnimatedButton variant="primary" loading>
              Loading
            </AnimatedButton>
            <AnimatedButton variant="primary" icon={<Upload className="w-4 h-4" />}>
              With Icon
            </AnimatedButton>
          </div>
        </section>

        {/* Forms */}
        <section className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-2xl font-bold mb-4">Form Fields</h2>
          <div className="space-y-4 max-w-md">
            <FormField
              label="Email"
              type="email"
              placeholder="you@example.com"
              required
            />
            <FormField
              label="Password"
              type="password"
              placeholder="Enter password"
              required
            />
            <FormField
              label="Name"
              placeholder="Enter your name"
              onValidate={(value) => {
                if (value.length < 3) return 'Name must be at least 3 characters';
                return null;
              }}
            />
          </div>
        </section>

        {/* Cards */}
        <section className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-2xl font-bold mb-4">Animated Cards</h2>
          <CardGrid columns={3}>
            <AnimatedCard hover>
              <h3 className="font-bold text-lg mb-2">Card 1</h3>
              <p className="text-gray-600">This card has hover effects</p>
            </AnimatedCard>
            <AnimatedCard hover>
              <h3 className="font-bold text-lg mb-2">Card 2</h3>
              <p className="text-gray-600">Smooth animations on hover</p>
            </AnimatedCard>
            <AnimatedCard hover>
              <h3 className="font-bold text-lg mb-2">Card 3</h3>
              <p className="text-gray-600">Professional polish</p>
            </AnimatedCard>
          </CardGrid>
        </section>

        {/* Data Table */}
        <section className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-2xl font-bold mb-4">Animated Table</h2>
          <AnimatedTable
            columns={tableColumns}
            data={tableData}
            rowKey="id"
            searchable
            selectable
          />
        </section>

        {/* Loading States */}
        <section className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-2xl font-bold mb-4">Loading States</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Progress Bar</h3>
              <ProgressBar
                progress={progress}
                label="Uploading files"
                estimatedTime={30}
              />
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Spinners</h3>
              <div className="flex gap-4 items-center">
                <Spinner size="sm" />
                <Spinner size="md" />
                <Spinner size="lg" />
                <Spinner size="md" label="Loading..." />
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Stage Indicator</h3>
              <StageIndicator stages={stages} currentStage="2" />
            </div>

            <div>
              <h3 className="font-semibold mb-2">Skeleton Loader</h3>
              <SkeletonLoader />
            </div>
          </div>
        </section>

        {/* Success Animations */}
        <section className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-2xl font-bold mb-4">Success Animations</h2>
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <SuccessCheckmark size="sm" />
              <SuccessCheckmark size="md" />
              <SuccessCheckmark size="lg" />
            </div>

            <div className="flex items-center gap-6">
              <CountUp to={1500} duration={2} separator="," />
              <CountUp to={99.9} duration={2} decimals={1} suffix="%" />
              <CountUp to={45000} duration={2} prefix="$" separator="," />
            </div>

            <AnimatedButton
              variant="primary"
              onClick={handleSimulateUpload}
              loading={loading}
            >
              Simulate Upload
            </AnimatedButton>
          </div>
        </section>

        {/* Success Card */}
        {showSuccess && (
          <section>
            <SuccessCard
              title="Import Complete!"
              message="Your rate cards have been successfully imported"
              stats={{
                recordsImported: 150,
                timeElapsed: 45,
                validationsPassed: 150,
              }}
              actions={[
                {
                  label: 'View Rate Cards',
                  onClick: () => success('Navigating...'),
                  variant: 'primary',
                },
                {
                  label: 'Import More',
                  onClick: () => setShowSuccess(false),
                  variant: 'secondary',
                },
              ]}
              onClose={() => setShowSuccess(false)}
            />
          </section>
        )}
      </div>
    </div>
  );
}
