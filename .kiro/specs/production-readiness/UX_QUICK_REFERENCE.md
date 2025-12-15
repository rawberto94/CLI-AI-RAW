# User Experience Improvements - Quick Reference

## Quick Start Guide

### 1. Loading States

**Show a loading spinner:**
```tsx
import { LoadingSpinner } from '@/components/ui/loading-states';

<LoadingSpinner size="md" variant="default" label="Loading..." />
```

**Show page loading:**
```tsx
import { PageLoading } from '@/components/ui/loading-states';

<PageLoading 
  title="Loading Contracts" 
  description="Please wait..."
  showProgress
  progress={50}
/>
```

**Show skeleton screen:**
```tsx
import { ContractListSkeleton } from '@/components/ui/loading-states';

{isLoading ? <ContractListSkeleton /> : <ContractList data={data} />}
```

**Loading button:**
```tsx
import { LoadingButton } from '@/components/ui/loading-states';

<LoadingButton loading={isLoading} loadingText="Saving...">
  Save
</LoadingButton>
```

---

### 2. User Feedback

**Show success toast:**
```tsx
import { useFeedback } from '@/components/feedback/FeedbackSystem';

const feedback = useFeedback();
feedback.showSuccess('Success!', 'Your changes have been saved');
```

**Show error toast:**
```tsx
feedback.showError('Error', 'Failed to save changes', {
  action: {
    label: 'Retry',
    onClick: () => retry(),
  },
});
```

**Show progress notification:**
```tsx
const id = feedback.showProgress('Processing', 0, 'Starting...');
// Update progress
feedback.updateProgress(id, 50, 'Half way there...');
// Complete
feedback.updateProgress(id, 100, 'Done!');
```

**Inline error message:**
```tsx
import { InlineError } from '@/components/feedback/FeedbackSystem';

<InlineError 
  message="Unable to connect to server"
  onRetry={handleRetry}
/>
```

---

### 3. Keyboard Shortcuts

**Add global shortcuts (in app root):**
```tsx
import { GlobalKeyboardShortcuts } from '@/components/keyboard/GlobalKeyboardShortcuts';

<GlobalKeyboardShortcuts>
  <YourApp />
</GlobalKeyboardShortcuts>
```

**Add page-specific shortcuts:**
```tsx
import { usePageShortcuts } from '@/components/keyboard/GlobalKeyboardShortcuts';

usePageShortcuts([
  {
    key: 's',
    ctrl: true,
    description: 'Save changes',
    action: handleSave,
    category: 'Actions',
  },
]);
```

**Global shortcuts available:**
- `?` - Show keyboard shortcuts help
- `Ctrl+K` - Open command palette
- `/` - Focus search
- `Ctrl+/` - Open AI assistant
- `Ctrl+S` - Save
- `Escape` - Cancel/Close
- `Ctrl+H` - Go to home
- `Ctrl+Shift+C` - Go to contracts

---

### 4. Responsive Design

**Detect device type:**
```tsx
import { useIsMobile, useIsTablet, useIsDesktop } from '@/hooks/useResponsive';

const isMobile = useIsMobile();
const isTablet = useIsTablet();
const isDesktop = useIsDesktop();
```

**Responsive grid:**
```tsx
import { ResponsiveGrid } from '@/components/layout/ResponsiveLayout';

<ResponsiveGrid cols={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
  {items.map(item => <Card key={item.id} {...item} />)}
</ResponsiveGrid>
```

**Conditional rendering:**
```tsx
import { ResponsiveShow, ResponsiveHide } from '@/components/layout/ResponsiveLayout';

<ResponsiveShow on="mobile">
  <MobileMenu />
</ResponsiveShow>

<ResponsiveHide on="mobile">
  <DesktopMenu />
</ResponsiveHide>
```

**Responsive table:**
```tsx
import { ResponsiveTable } from '@/components/layout/ResponsiveLayout';

<ResponsiveTable
  headers={['Name', 'Email', 'Status']}
  rows={data}
  mobileCardRenderer={(row) => <MobileCard data={row} />}
/>
```

---

### 5. Accessibility

**Accessible modal:**
```tsx
import { AccessibleModal } from '@/components/accessibility/AccessibleComponents';

<AccessibleModal
  isOpen={isOpen}
  onClose={onClose}
  title="Confirm Action"
  description="Are you sure you want to proceed?"
>
  <ModalContent />
</AccessibleModal>
```

**Accessible button:**
```tsx
import { AccessibleButton } from '@/components/accessibility/AccessibleComponents';

<AccessibleButton 
  variant="primary"
  ariaLabel="Save document"
  onClick={handleSave}
>
  Save
</AccessibleButton>
```

**Accessible form field:**
```tsx
import { AccessibleFormField } from '@/components/accessibility/AccessibleComponents';

<AccessibleFormField
  id="email"
  label="Email Address"
  required
  error={errors.email}
  hint="We'll never share your email"
>
  <input type="email" />
</AccessibleFormField>
```

**Screen reader announcement:**
```tsx
import { useAnnouncer } from '@/hooks/useAccessibility';

const { announce } = useAnnouncer();
announce('Form submitted successfully');
```

**Skip links:**
```tsx
import { SkipLinks } from '@/components/accessibility/AccessibleComponents';

<SkipLinks />
```

---

## Common Patterns

### Pattern 1: Form with Loading and Feedback
```tsx
function MyForm() {
  const { isLoading, executeWithLoading } = useLoadingState();
  const feedback = useFeedback();

  const handleSubmit = async (data) => {
    await executeWithLoading(async () => {
      try {
        await saveData(data);
        feedback.showSuccess('Saved', 'Your changes have been saved');
      } catch (error) {
        feedback.showError('Error', error.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <LoadingButton loading={isLoading} type="submit">
        Save
      </LoadingButton>
    </form>
  );
}
```

### Pattern 2: Responsive Page with Loading
```tsx
function MyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadData().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageLoading title="Loading..." />;
  }

  return (
    <ResponsiveContainer>
      {isMobile ? <MobileView data={data} /> : <DesktopView data={data} />}
    </ResponsiveContainer>
  );
}
```

### Pattern 3: Accessible Modal with Keyboard Shortcuts
```tsx
function MyModal({ isOpen, onClose }) {
  usePageShortcuts([
    {
      key: 'Escape',
      description: 'Close modal',
      action: onClose,
      enabled: isOpen,
    },
  ]);

  return (
    <AccessibleModal isOpen={isOpen} onClose={onClose} title="Settings">
      {/* modal content */}
    </AccessibleModal>
  );
}
```

---

## Cheat Sheet

### Loading States
| Component | Use Case |
|-----------|----------|
| `LoadingSpinner` | Small inline loading |
| `PageLoading` | Full page loading |
| `ContractListSkeleton` | Contract list loading |
| `RateCardTableSkeleton` | Rate card table loading |
| `DashboardSkeleton` | Dashboard loading |
| `LoadingButton` | Button with loading state |
| `OverlayLoading` | Modal/dialog loading |

### Feedback Types
| Method | Use Case |
|--------|----------|
| `showSuccess()` | Successful operations |
| `showError()` | Failed operations |
| `showWarning()` | Warnings |
| `showInfo()` | Information |
| `showProgress()` | Long operations |

### Responsive Breakpoints
| Breakpoint | Width | Device |
|------------|-------|--------|
| `xs` | 0px | Mobile portrait |
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Extra large |

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `?` | Show help |
| `Ctrl+K` | Command palette |
| `/` | Focus search |
| `Ctrl+/` | AI assistant |
| `Ctrl+S` | Save |
| `Escape` | Cancel |
| `Tab` | Next element |
| `Shift+Tab` | Previous element |

### Accessibility Checklist
- [ ] All images have alt text
- [ ] All buttons have labels
- [ ] All forms have labels
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast 4.5:1
- [ ] Screen reader tested

---

## Resources

- **Loading States**: `apps/web/components/ui/loading-states.tsx`
- **Feedback System**: `apps/web/components/feedback/FeedbackSystem.tsx`
- **Keyboard Shortcuts**: `apps/web/components/keyboard/GlobalKeyboardShortcuts.tsx`
- **Responsive Design**: `apps/web/components/layout/ResponsiveLayout.tsx`
- **Accessibility**: `apps/web/components/accessibility/AccessibleComponents.tsx`

- **Examples**: Check `*Examples.tsx` files for each feature
- **Full Documentation**: `.kiro/specs/production-readiness/TASK_11_COMPLETE.md`
- **Accessibility Checklist**: `apps/web/components/accessibility/ACCESSIBILITY_CHECKLIST.md`
