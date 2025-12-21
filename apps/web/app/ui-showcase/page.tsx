'use client';

/**
 * UI Component Showcase
 * Interactive demo page for all enhanced UI components
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Heart,
  Zap,
  Download,
  Share,
  Settings,
  Bell,
  Search,
  Plus,
  Trash2,
  Edit,
  Copy,
  Archive,
  Star,
  Filter,
  ChevronRight,
  Mail,
  Lock,
  User,
  CreditCard,
  Home,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  Upload,
  LayoutGrid,
  List,
  Moon,
  Sun,
} from 'lucide-react';

// Import enhanced components
import {
  GradientButton,
  IconButton,
  AsyncActionButton,
  FAB,
  SplitButton,
} from '@/components/ui/enhanced-buttons';

import {
  EnhancedBadge,
  StatusBadge,
  CountBadge,
  TrendBadge,
  PriorityBadge,
  FeatureBadge,
} from '@/components/ui/enhanced-badges';

import {
  HoverCard,
  SelectableCard,
  StatsCard,
  FeatureCard,
  PricingCard,
  ExpandableCard,
} from '@/components/ui/interactive-cards';

import {
  AnimatedToggle,
  LikeButton,
  CopyFeedbackButton,
  ProgressRing,
  DeleteButton,
} from '@/components/ui/micro-interactions';

import {
  EnhancedInput,
  SearchInput,
  FloatingLabelInput,
  PinInput,
  EnhancedCheckbox,
  EnhancedRadio,
} from '@/components/ui/enhanced-inputs';

import {
  CardSkeleton,
  AnimatedSpinner,
  BouncingDots,
  AnimatedProgressBar,
} from '@/components/ui/enhanced-loading';

import {
  EnhancedEmptyState,
  SearchNoResults,
  EnhancedSuccessState,
  AlertBanner,
} from '@/components/ui/feedback-states';

import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  DeleteDialog,
  Drawer,
  useModal,
} from '@/components/ui/enhanced-modals';

import {
  Avatar,
  AvatarGroup,
  Timeline,
  DataTable,
  KeyValueList,
  ProgressTracker,
} from '@/components/ui/data-display';

import {
  Dropzone,
  FileItem,
  ImageUpload,
} from '@/components/ui/file-upload';

import {
  InlineAlert,
} from '@/components/ui/notification-system';

import {
  EnhancedTooltip,
  RichTooltip,
  DropdownMenu,
  CommandMenu,
  SelectMenu,
} from '@/components/ui/tooltips-popovers';

import {
  AnimatedTabs,
  TabPanel,
  Breadcrumbs,
  Pagination,
  Stepper,
  ProgressSteps,
  SegmentedControl,
} from '@/components/ui/navigation-components';

// ============================================
// Demo Sections
// ============================================

function ButtonsSection() {
  const [asyncState, setAsyncState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleAsyncAction = async () => {
    setAsyncState('loading');
    await new Promise(r => setTimeout(r, 2000));
    setAsyncState(Math.random() > 0.3 ? 'success' : 'error');
    await new Promise(r => setTimeout(r, 1500));
    setAsyncState('idle');
  };

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Enhanced Buttons
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GradientButton gradient="primary" shimmer>
          <Sparkles className="w-4 h-4" />
          Primary
        </GradientButton>
        
        <GradientButton gradient="success" glow>
          <CheckCircle className="w-4 h-4" />
          Success
        </GradientButton>
        
        <GradientButton gradient="warning">
          <AlertCircle className="w-4 h-4" />
          Warning
        </GradientButton>
        
        <GradientButton gradient="danger">
          <Trash2 className="w-4 h-4" />
          Danger
        </GradientButton>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <IconButton icon={<Heart />} tooltip="Like" />
        <IconButton icon={<Share />} tooltip="Share" badge={3} />
        <IconButton icon={<Bell />} tooltip="Notifications" badge="!" variant="ghost" />
        <IconButton icon={<Settings />} tooltip="Settings" variant="outline" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <AsyncActionButton
          state={asyncState}
          onClick={handleAsyncAction}
          labels={{
            idle: 'Save Changes',
            loading: 'Saving...',
            success: 'Saved!',
            error: 'Failed',
          }}
        />

        <SplitButton
          label="Download"
          icon={<Download className="w-4 h-4" />}
          options={[
            { label: 'PDF', onClick: () => {} },
            { label: 'Word', onClick: () => {} },
            { label: 'CSV', onClick: () => {} },
          ]}
        />
      </div>
    </section>
  );
}

function BadgesSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Enhanced Badges
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <EnhancedBadge variant="default">Default</EnhancedBadge>
        <EnhancedBadge variant="success" pulse>Active</EnhancedBadge>
        <EnhancedBadge variant="warning">Pending</EnhancedBadge>
        <EnhancedBadge variant="danger" glow>Critical</EnhancedBadge>
        <EnhancedBadge variant="info">Info</EnhancedBadge>
        <EnhancedBadge variant="premium" icon={<Star className="w-3 h-3" />}>Premium</EnhancedBadge>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status="online" />
        <StatusBadge status="offline" />
        <StatusBadge status="away" />
        <StatusBadge status="busy" />
        <StatusBadge status="pending" showLabel />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <CountBadge count={5} label="Messages" />
        <CountBadge count={99} max={50} label="Notifications" variant="danger" />
        <TrendBadge value={12.5} label="Growth" />
        <TrendBadge value={-5.2} label="Decline" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PriorityBadge priority="critical" />
        <PriorityBadge priority="high" />
        <PriorityBadge priority="medium" />
        <PriorityBadge priority="low" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FeatureBadge type="new" />
        <FeatureBadge type="beta" />
        <FeatureBadge type="pro" />
        <FeatureBadge type="deprecated" />
      </div>
    </section>
  );
}

function CardsSection() {
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  const toggleCard = (id: string) => {
    setSelectedCards(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Interactive Cards
      </h2>

      <div className="grid md:grid-cols-3 gap-4">
        <HoverCard variant="elevated">
          <div className="p-4">
            <h3 className="font-medium">Hover Card</h3>
            <p className="text-sm text-slate-500">Hover to see the effect</p>
          </div>
        </HoverCard>

        <SelectableCard
          selected={selectedCards.includes('card1')}
          onSelect={() => toggleCard('card1')}
        >
          <div className="p-4">
            <h3 className="font-medium">Selectable Card</h3>
            <p className="text-sm text-slate-500">Click to select</p>
          </div>
        </SelectableCard>

        <ExpandableCard
          header={<h3 className="font-medium">Expandable Card</h3>}
          defaultExpanded={false}
        >
          <p className="text-sm text-slate-500">
            This content is hidden by default and reveals on expansion.
          </p>
        </ExpandableCard>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value="12,543"
          trend={12}
          trendLabel="vs last month"
          icon={<User className="w-5 h-5" />}
        />
        <StatsCard
          title="Revenue"
          value="$45,231"
          trend={-3.2}
          trendLabel="vs last month"
          icon={<CreditCard className="w-5 h-5" />}
        />
        <StatsCard
          title="Documents"
          value="1,234"
          trend={8}
          trendLabel="vs last week"
          icon={<FileText className="w-5 h-5" />}
        />
        <StatsCard
          title="Contracts"
          value="89"
          trend={0}
          trendLabel="no change"
          icon={<CheckCircle className="w-5 h-5" />}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <FeatureCard
          title="AI Analysis"
          description="Automatically analyze contracts with AI"
          icon={<Zap className="w-6 h-6" />}
          gradient="blue"
        />
        <FeatureCard
          title="Smart Search"
          description="Find any clause or term instantly"
          icon={<Search className="w-6 h-6" />}
          gradient="purple"
        />
        <FeatureCard
          title="Collaboration"
          description="Work together in real-time"
          icon={<Share className="w-6 h-6" />}
          gradient="green"
        />
      </div>
    </section>
  );
}

function MicroInteractionsSection() {
  const [toggle1, setToggle1] = useState(false);
  const [toggle2, setToggle2] = useState(true);
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(65);

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Micro Interactions
      </h2>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Notifications</span>
          <AnimatedToggle checked={toggle1} onChange={setToggle1} />
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Dark Mode</span>
          <AnimatedToggle
            checked={toggle2}
            onChange={setToggle2}
            size="lg"
            icons={{ on: <Moon className="w-3 h-3" />, off: <Sun className="w-3 h-3" /> }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <LikeButton
          liked={liked}
          onClick={() => setLiked(!liked)}
          count={42}
        />
        
        <CopyFeedbackButton text="npm install @example/ui" />
        
        <DeleteButton onDelete={() => alert('Deleted!')} />
      </div>

      <div className="flex items-center gap-6">
        <ProgressRing progress={progress} size={80} />
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Adjust progress:</p>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={e => setProgress(Number(e.target.value))}
            className="w-48"
          />
        </div>
      </div>
    </section>
  );
}

function InputsSection() {
  const [searchValue, setSearchValue] = useState('');
  const [pin, setPin] = useState('');

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Enhanced Inputs
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <EnhancedInput
          label="Email Address"
          placeholder="you@example.com"
          leftIcon={<Mail className="w-4 h-4" />}
          helperText="We'll never share your email"
        />

        <EnhancedInput
          label="Password"
          type="password"
          placeholder="Enter password"
          leftIcon={<Lock className="w-4 h-4" />}
        />

        <SearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="Search contracts..."
          onSearch={v => console.log('Search:', v)}
        />

        <FloatingLabelInput label="Full Name" placeholder="" />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">PIN Input</h3>
        <PinInput
          length={6}
          value={pin}
          onChange={setPin}
          onComplete={v => console.log('PIN complete:', v)}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Checkboxes</h3>
          <EnhancedCheckbox label="Accept terms and conditions" />
          <EnhancedCheckbox label="Subscribe to newsletter" defaultChecked />
          <EnhancedCheckbox label="Card style" variant="card" />
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Radio Buttons</h3>
          <EnhancedRadio name="plan" value="free" label="Free Plan" />
          <EnhancedRadio name="plan" value="pro" label="Pro Plan" defaultChecked />
          <EnhancedRadio name="plan" value="enterprise" label="Enterprise" variant="card" />
        </div>
      </div>
    </section>
  );
}

function LoadingSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Loading States
      </h2>

      <div className="grid md:grid-cols-3 gap-4">
        <CardSkeleton variant="simple" />
        <CardSkeleton variant="media" />
        <CardSkeleton variant="stats" />
      </div>

      <div className="flex flex-wrap items-center gap-8">
        <div className="text-center">
          <AnimatedSpinner size="lg" />
          <p className="mt-2 text-sm text-slate-500">Spinner</p>
        </div>
        
        <div className="text-center">
          <BouncingDots size="lg" />
          <p className="mt-2 text-sm text-slate-500">Bouncing</p>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatedProgressBar progress={45} color="blue" showLabel />
        <AnimatedProgressBar progress={75} color="green" showLabel />
        <AnimatedProgressBar progress={90} color="gradient" showLabel />
        <AnimatedProgressBar indeterminate color="purple" />
      </div>
    </section>
  );
}

function NavigationSection() {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentStep, setCurrentStep] = useState(1);
  const [viewMode, setViewMode] = useState('grid');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Home className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', badge: 12 },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const steps = [
    { id: 'upload', label: 'Upload', description: 'Upload your files' },
    { id: 'review', label: 'Review', description: 'Review details' },
    { id: 'confirm', label: 'Confirm', description: 'Confirm and submit' },
  ];

  return (
    <section className="space-y-8">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Navigation Components
      </h2>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Animated Tabs</h3>
        <AnimatedTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="default"
        />
        <TabPanel value="overview" activeValue={activeTab}>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            Overview content here
          </div>
        </TabPanel>
        <TabPanel value="documents" activeValue={activeTab}>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            Documents content here
          </div>
        </TabPanel>
        <TabPanel value="settings" activeValue={activeTab}>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            Settings content here
          </div>
        </TabPanel>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Breadcrumbs</h3>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Documents', href: '/documents' },
            { label: 'Contracts', href: '/documents/contracts' },
            { label: 'Contract #123' },
          ]}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Pagination</h3>
        <Pagination
          currentPage={currentPage}
          totalPages={10}
          onPageChange={setCurrentPage}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Stepper</h3>
        <Stepper
          steps={steps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
          clickable
        />
        <div className="flex gap-4 justify-center mt-4">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Next
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Segmented Control</h3>
        <SegmentedControl
          options={[
            { value: 'grid', label: 'Grid', icon: <LayoutGrid className="w-4 h-4" /> },
            { value: 'list', label: 'List', icon: <List className="w-4 h-4" /> },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
      </div>
    </section>
  );
}

function TooltipsSection() {
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');

  const menuItems = [
    { label: 'Edit', icon: <Edit className="w-4 h-4" />, shortcut: '⌘E', onClick: () => {} },
    { label: 'Copy', icon: <Copy className="w-4 h-4" />, shortcut: '⌘C', onClick: () => {} },
    { label: 'Archive', icon: <Archive className="w-4 h-4" />, onClick: () => {} },
    { separator: true, label: '' },
    { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => {} },
  ];

  const commandItems = [
    { id: '1', label: 'New Document', icon: <Plus className="w-4 h-4" />, shortcut: '⌘N', group: 'Actions', onSelect: () => {} },
    { id: '2', label: 'Upload File', icon: <Upload className="w-4 h-4" />, shortcut: '⌘U', group: 'Actions', onSelect: () => {} },
    { id: '3', label: 'Search', icon: <Search className="w-4 h-4" />, shortcut: '⌘K', group: 'Navigation', onSelect: () => {} },
    { id: '4', label: 'Settings', icon: <Settings className="w-4 h-4" />, shortcut: '⌘,', group: 'Navigation', onSelect: () => {} },
  ];

  const countries = [
    { value: 'us', label: 'United States', description: 'North America' },
    { value: 'uk', label: 'United Kingdom', description: 'Europe' },
    { value: 'de', label: 'Germany', description: 'Europe' },
    { value: 'jp', label: 'Japan', description: 'Asia' },
    { value: 'ch', label: 'Switzerland', description: 'Europe' },
  ];

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Tooltips & Popovers
      </h2>

      <div className="flex flex-wrap items-center gap-6">
        <EnhancedTooltip content="Simple tooltip">
          <button className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg">
            Hover me
          </button>
        </EnhancedTooltip>

        <RichTooltip
          title="Save Document"
          description="Save your changes to the cloud"
          shortcut="⌘S"
        >
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg">
            Rich Tooltip
          </button>
        </RichTooltip>

        <DropdownMenu
          trigger={
            <button className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center gap-2">
              Actions <ChevronRight className="w-4 h-4 rotate-90" />
            </button>
          }
          items={menuItems}
        />
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <button
          onClick={() => setCommandMenuOpen(true)}
          className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg flex items-center gap-2"
        >
          Open Command Menu <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-white/20 dark:bg-black/20 rounded">⌘K</kbd>
        </button>

        <CommandMenu
          isOpen={commandMenuOpen}
          onClose={() => setCommandMenuOpen(false)}
          items={commandItems}
        />
      </div>

      <div className="max-w-sm">
        <SelectMenu
          label="Select Country"
          options={countries}
          value={selectedCountry}
          onChange={setSelectedCountry}
          placeholder="Choose a country..."
        />
      </div>
    </section>
  );
}

function FeedbackSection() {
  const [showSuccess, setShowSuccess] = useState(false);

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Feedback States
      </h2>

      <div className="space-y-4">
        <AlertBanner type="info" title="Information" dismissible>
          This is an informational message with helpful context.
        </AlertBanner>
        
        <AlertBanner type="success" title="Success">
          Your changes have been saved successfully.
        </AlertBanner>
        
        <AlertBanner type="warning" title="Warning">
          Your subscription will expire in 7 days.
        </AlertBanner>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <SearchNoResults query="contract template" />
        
        <EnhancedEmptyState
          title="No documents yet"
          description="Upload your first document to get started"
          icon={<FileText className="w-12 h-12" />}
          action={{ label: 'Upload Document', onClick: () => {} }}
        />
      </div>

      <div>
        <button
          onClick={() => setShowSuccess(!showSuccess)}
          className="mb-4 px-4 py-2 bg-green-500 text-white rounded-lg"
        >
          Toggle Success State
        </button>
        
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <EnhancedSuccessState
                title="Payment Successful!"
                description="Your payment has been processed successfully."
                confetti
                action={{ label: 'View Receipt', onClick: () => {} }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ============================================
// Main Showcase Page
// ============================================

function ModalsSection() {
  const modal = useModal();
  const drawer = useModal();
  const deleteModal = useModal();

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Modals & Dialogs
      </h2>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={modal.open}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Open Modal
        </button>

        <button
          onClick={drawer.open}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
        >
          Open Drawer
        </button>

        <button
          onClick={deleteModal.open}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Delete Confirmation
        </button>
      </div>

      <Modal isOpen={modal.isOpen} onClose={modal.close}>
        <ModalHeader>
          <ModalTitle description="This is a beautiful modal component">
            Enhanced Modal
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-slate-600 dark:text-slate-400">
            This modal includes smooth animations, keyboard support (Escape to close),
            and click-outside-to-dismiss functionality.
          </p>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={modal.close}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={modal.close}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Confirm
          </button>
        </ModalFooter>
      </Modal>

      <Drawer
        isOpen={drawer.isOpen}
        onClose={drawer.close}
        title="Settings"
        description="Manage your preferences"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={drawer.close} className="px-4 py-2 text-slate-600">
              Cancel
            </button>
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg">
              Save Changes
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Drawer content goes here. It slides in from the side with smooth animations.
          </p>
        </div>
      </Drawer>

      <DeleteDialog
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={() => { deleteModal.close(); alert('Deleted!'); }}
        itemName="Project Alpha"
        itemType="project"
      />
    </section>
  );
}

function DataDisplaySection() {
  const timelineItems = [
    { id: '1', title: 'Contract Created', description: 'Initial draft submitted', time: '2 hours ago', color: 'success' as const },
    { id: '2', title: 'Review Started', description: 'Legal team reviewing', time: '1 hour ago', color: 'info' as const },
    { id: '3', title: 'Comments Added', description: '3 comments from reviewers', time: '30 min ago', color: 'warning' as const },
    { id: '4', title: 'Pending Approval', description: 'Waiting for final sign-off', time: 'Now', color: 'default' as const },
  ];

  const keyValues = [
    { key: 'Contract ID', value: 'CTR-2024-001' },
    { key: 'Status', value: <span className="text-green-600">Active</span> },
    { key: 'Created', value: 'Dec 21, 2024' },
    { key: 'Expires', value: 'Dec 21, 2025' },
  ];

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Data Display
      </h2>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name="John Doe" size="lg" status="online" />
        <Avatar name="Jane Smith" size="lg" status="away" />
        <Avatar name="Bob Wilson" size="lg" status="busy" />
        <AvatarGroup
          avatars={[
            { name: 'Alice' },
            { name: 'Bob' },
            { name: 'Charlie' },
            { name: 'Diana' },
            { name: 'Eve' },
          ]}
          max={3}
          size="lg"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Timeline</h3>
          <Timeline items={timelineItems} />
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Key-Value List</h3>
          <KeyValueList items={keyValues} variant="card" />

          <h3 className="text-lg font-medium mt-6 mb-4">Progress Tracker</h3>
          <div className="space-y-4">
            <ProgressTracker label="Storage Used" current={7.5} total={10} unit="GB" color="blue" />
            <ProgressTracker label="Documents Processed" current={85} total={100} color="green" />
          </div>
        </div>
      </div>
    </section>
  );
}

function FileUploadSection() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        File Upload
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Dropzone</h3>
          <Dropzone
            onFilesAccepted={(newFiles) => setFiles(prev => [...prev, ...newFiles])}
            accept=".pdf,.doc,.docx"
            maxSize={10 * 1024 * 1024}
          />

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, index) => (
                <FileItem
                  key={index}
                  file={file}
                  status="success"
                  onRemove={() => setFiles(prev => prev.filter((_, i) => i !== index))}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Image Upload</h3>
          <ImageUpload
            onChange={(file, preview) => console.log('Image:', file, preview)}
            aspectRatio="landscape"
          />
        </div>
      </div>
    </section>
  );
}

function AlertsSection() {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Inline Alerts
      </h2>

      <div className="space-y-4">
        <InlineAlert type="info" title="Pro Tip">
          You can use keyboard shortcuts to navigate faster. Press <kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">?</kbd> to see all shortcuts.
        </InlineAlert>

        <InlineAlert type="success" title="Upload Complete" dismissible>
          Your document has been successfully uploaded and is now being processed.
        </InlineAlert>

        <InlineAlert
          type="warning"
          title="Storage Almost Full"
          action={{ label: 'Upgrade Plan', onClick: () => {} }}
        >
          You've used 90% of your storage. Consider upgrading to continue uploading files.
        </InlineAlert>

        <InlineAlert type="error" title="Connection Lost" dismissible>
          Unable to connect to the server. Please check your internet connection and try again.
        </InlineAlert>
      </div>
    </section>
  );
}

export default function UIShowcase() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-blue-500" />
                UI Component Showcase
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Beautiful, accessible, and animated components
              </p>
            </div>
            
            <FAB icon={<Plus className="w-5 h-5" />} label="Add Component" size="md" />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-16">
        <ButtonsSection />
        <BadgesSection />
        <CardsSection />
        <MicroInteractionsSection />
        <InputsSection />
        <LoadingSection />
        <NavigationSection />
        <TooltipsSection />
        <FeedbackSection />
        <ModalsSection />
        <DataDisplaySection />
        <FileUploadSection />
        <AlertsSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>Built with Framer Motion, Radix UI, and Tailwind CSS</p>
        </div>
      </footer>
    </div>
  );
}
